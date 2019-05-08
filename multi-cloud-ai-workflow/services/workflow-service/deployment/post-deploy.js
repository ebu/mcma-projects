//"use strict";

global.fetch = require('node-fetch');

const fs = require("fs");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');

const MCMA_CORE = require("mcma-core");

const JOB_PROFILES = {
    ConformWorkflow: new MCMA_CORE.JobProfile({
        name: "ConformWorkflow",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "metadata", parameterType: "DescriptiveMetadata" }),
            new MCMA_CORE.JobParameter({ parameterName: "inputFile", parameterType: "Locator" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "websiteMediaFile", parameterType: "Locator" }),
            new MCMA_CORE.JobParameter({ parameterName: "aiWorkflow", parameterType: "WorkflowJob" }),
            new MCMA_CORE.JobParameter({ parameterName: "bmContent", parameterType: "BMContent" })
        ]
    }),
    AiWorkflow: new MCMA_CORE.JobProfile({
        name: "AiWorkflow",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "bmContent", parameterType: "BMContent" }),
            new MCMA_CORE.JobParameter({ parameterName: "bmEssence", parameterType: "BMEssence" })
        ]
    })
}

const convertTerraformOutputToJSON = (content) => {
    let object = {};

    let lines = content.split("\n");
    for (const line of lines) {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            object[parts[0]] = parts[1];
        }
    }

    return object;
}

const main = async () => {
    if (process.argv.length !== 3) {
        console.error("Missing input file");
        process.exit(1);
    }

    try {
        let params = convertTerraformOutputToJSON(fs.readFileSync(process.argv[2], "utf8"));

        // 1. Initializing resource manager
        let servicesUrl = params.services_url;
        let servicesAuthType = params.services_auth_type;
        let servicesAuthContext = params.services_auth_context;

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

        // 2. Inserting / updating job profile(s)
        let retrievedJobProfiles = await resourceManager.get("JobProfile");

        for (const retrievedJobProfile of retrievedJobProfiles) {
            let jobProfile = JOB_PROFILES[retrievedJobProfile.name];

            if (jobProfile) {
                if (!jobProfile.id) {
                    jobProfile.id = retrievedJobProfile.id;

                    console.log("Updating JobProfile '" + jobProfile.name + "'");
                    await resourceManager.update(jobProfile);
                } else {
                    console.log("Removing duplicate JobProfile '" + retrievedJobProfile.name + "'");
                    await resourceManager.delete(retrievedJobProfile);
                }
            }
        }

        for (const jobProfileName in JOB_PROFILES) {
            let jobProfile = JOB_PROFILES[jobProfileName];
            if (!jobProfile.id) {
                console.log("Inserting JobProfile '" + jobProfile.name + "'");
                JOB_PROFILES[jobProfileName] = await resourceManager.create(jobProfile);
            }
        }

        // 3. Inserting / Updating service
        let name = "Workflow Service";
        let url = params.workflow_service_url;
        let notificationUrl = params.workflow_service_notification_url
        let authType = params.workflow_service_auth_type;
        let authContext = params.workflow_service_auth_context;

        let service = new MCMA_CORE.Service({
            name,
            resources: [
                new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: url + "/job-assignments" }),
                // new MCMA_CORE.ResourceEndpoint({ resourceType: "Notification", httpEndpoint: notificationUrl })
            ],
            authType,
            authContext,
            jobType: "WorkflowJob",
            jobProfiles: [
                JOB_PROFILES.ConformWorkflow.id ? JOB_PROFILES.ConformWorkflow.id : JOB_PROFILES.ConformWorkflow,
                JOB_PROFILES.AiWorkflow.id ? JOB_PROFILES.AiWorkflow.id : JOB_PROFILES.AiWorkflow
            ]
        });

        let retrievedServices = await resourceManager.get("Service");

        for (const retrievedService of retrievedServices) {
            if (retrievedService.name === name) {
                if (!service.id) {
                    service.id = retrievedService.id;

                    console.log("Updating " + name);
                    await resourceManager.update(service);
                } else {
                    console.log("Removing duplicate " + name + " '" + retrievedService.id + "'");
                    await resourceManager.delete(retrievedService);
                }
            }
        }

        if (!service.id) {
            console.log("Inserting " + name);
            service = await resourceManager.create(service);
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
