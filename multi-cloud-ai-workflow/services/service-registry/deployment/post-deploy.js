//"use strict";

global.fetch = require('node-fetch');

const fs = require("fs");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');

const MCMA_CORE = require("mcma-core");

const convertTerraformOutputToJSON = (content) => {
    let serviceUrls = {};

    let lines = content.split("\n");
    for (const line of lines) {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            serviceUrls[parts[0]] = parts[1];
        }
    }

    return serviceUrls;
}

const main = async () => {
    if (process.argv.length !== 3) {
        console.error("Missing input file");
        process.exit(1);
    }

    try {
        let params = convertTerraformOutputToJSON(fs.readFileSync(process.argv[2], "utf8"));

        let servicesUrl = params.services_url;
        let servicesAuthType = params.services_auth_type;
        let servicesAuthContext = params.services_auth_context;
        let jobProfilesUrl = params.service_registry_url + "/job-profiles";

        let serviceRegistry = new MCMA_CORE.Service({
            name: "Service Registry",
            resources: [
                new MCMA_CORE.ResourceEndpoint({ resourceType: "Service", httpEndpoint: servicesUrl }),
                new MCMA_CORE.ResourceEndpoint({ resourceType: "JobProfile", httpEndpoint: jobProfilesUrl })
            ],
            authType: servicesAuthType,
            authContext: servicesAuthContext
        });

        const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
            accessKey: AWS.config.credentials.accessKeyId,
            secretKey: AWS.config.credentials.secretAccessKey,
            sessionToken: AWS.config.credentials.sessionToken,
            region: AWS.config.region
        });

        const authProvider = new MCMA_CORE.AuthenticatorProvider(
            async (authType, authContext) => {
                switch (authType) {
                    case "AWS4":
                        return authenticatorAWS4;
                }
            }
        );

        let resourceManager = new MCMA_CORE.ResourceManager({
            servicesUrl,
            servicesAuthType,
            servicesAuthContext,
            authProvider
        });

        // fetch all services and insert/update service registry
        let retrievedServices = await resourceManager.get("Service");

        for (const retrievedService of retrievedServices) {
            if (retrievedService.name === "Service Registry") {
                if (!serviceRegistry.id) {
                    serviceRegistry.id = retrievedService.id;

                    console.log("Updating Service Registry");
                    await resourceManager.update(serviceRegistry);
                } else {
                    console.log("Removing duplicate Service Registry '" + retrievedService.id + "'");
                    await resourceManager.delete(retrievedService);
                }
            }
        }

        if (!serviceRegistry.id) {
            console.log("Inserting Service Registry");
            serviceRegistry = await resourceManager.create(serviceRegistry);
        }
    } catch (error) {
        if (error.response) {
            console.error(JSON.stringify(error.response.data.message, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}
main();