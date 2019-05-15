//"use strict";

global.fetch = require('node-fetch');

const fs = require("fs");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');

const MCMA_CORE = require("mcma-core");

const JOB_PROFILES = {
    AWSStepFunctions: new MCMA_CORE.JobProfile({
        name: "AWSStepFunctions",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "workflow", parameterType: "AWSStepFunctionsWorkflow" }),
            new MCMA_CORE.JobParameter({ parameterName: "input", parameterType: "JobParameterBag" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "output", parameterType: "JobParameterBag" })
        ]
    }),
    AmazonSimpleWorkflow: new MCMA_CORE.JobProfile({
        name: "AmazonSimpleWorkflow",
        inputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "workflow", parameterType: "AmazonSimpleWorkflow" }),
            new MCMA_CORE.JobParameter({ parameterName: "input", parameterType: "JobParameterBag" })
        ],
        outputParameters: [
            new MCMA_CORE.JobParameter({ parameterName: "output", parameterType: "JobParameterBag" })
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
        let authType = params.workflow_service_auth_type;
        let authContext = params.workflow_service_auth_context;

        let service = new MCMA_CORE.Service({
            name,
            resources: [
                new MCMA_CORE.ResourceEndpoint({ resourceType: "JobAssignment", httpEndpoint: url + "/job-assignments" }),
                new MCMA_CORE.ResourceEndpoint({ resourceType: "Notification", httpEndpoint: url + "/activity-notifications" })
            ],
            authType,
            authContext,
            jobType: "WorkflowJob",
            jobProfiles: [
                JOB_PROFILES.AWSStepFunctions.id ? JOB_PROFILES.AWSStepFunctions.id : JOB_PROFILES.AWSStepFunctions,
                JOB_PROFILES.AmazonSimpleWorkflow.id ? JOB_PROFILES.AmazonSimpleWorkflow.id : JOB_PROFILES.AmazonSimpleWorkflow
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
