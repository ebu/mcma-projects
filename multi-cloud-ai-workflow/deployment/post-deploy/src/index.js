//"use strict";
const fs = require("fs");
const AWS = require("aws-sdk");
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");
const nodeFetch = require("node-fetch");

const { JobProfile, JobParameter, Service, ResourceEndpoint } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
const { awsV4Auth } = require("@mcma/aws-client");

global.fetch = nodeFetch;

AWS.config.loadFromPath("./aws-credentials.json");

const S3 = new AWS.S3();
const Cognito = new AWS.CognitoIdentityServiceProvider();

const JOB_PROFILES = {
    ConformWorkflow: new JobProfile({
        name: "ConformWorkflow",
        inputParameters: [
            new JobParameter({ parameterName: "metadata", parameterType: "DescriptiveMetadata" }),
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "websiteMediaFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "aiWorkflow", parameterType: "WorkflowJob" }),
            new JobParameter({ parameterName: "bmContent", parameterType: "BMContent" })
        ]
    }),
    AiWorkflow: new JobProfile({
        name: "AiWorkflow",
        inputParameters: [
            new JobParameter({ parameterName: "bmContent", parameterType: "BMContent" }),
            new JobParameter({ parameterName: "bmEssence", parameterType: "BMEssence" })
        ]
    }),
    ExtractTechnicalMetadata: new JobProfile({
        name: "ExtractTechnicalMetadata",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    CreateProxyLambda: new JobProfile({
        name: "CreateProxyLambda",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    CreateProxyEC2: new JobProfile({
        name: "CreateProxyEC2",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    ExtractAudio: new JobProfile({
        name: "ExtractAudio",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    ExtractThumbnail: new JobProfile({
        name: "ExtractThumbnail",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ],
        optionalInputParameters: [
            new JobParameter({ parameterName: "ebucore:width" }),
            new JobParameter({ parameterName: "ebucore:height" })
        ]
    }),
    AWSTextToSpeech: new JobProfile({
        name: "AWSTextToSpeech",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "voiceId", parameterType: "AWSVoiceId" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" }),
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSTokenizedTextToSpeech: new JobProfile({
        name: "AWSTokenizedTextToSpeech",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "voiceId", parameterType: "AWSVoiceId" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" }),
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSSsmlTextToSpeech: new JobProfile({
        name: "AWSSsmlTextToSpeech",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "voiceId", parameterType: "AWSVoiceId" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" }),
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSTranscribeAudio: new JobProfile({
        name: "AWSTranscribeAudio",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSTranslateText: new JobProfile({
        name: "AWSTranslateText",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "targetLanguageCode", parameterType: "awsLanguageCode" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ],
        optionalInputParameters: [
            new JobParameter({ parameterName: "sourceLanguageCode", parameterType: "awsLanguageCode" })
        ]
    }),
    CreateDubbingSrt: new JobProfile({
        name: "CreateDubbingSrt",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    ValidateSpeechToText: new JobProfile({
        name: "ValidateSpeechToText",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    ValidateSpeechToTextAzure: new JobProfile({
        name: "ValidateSpeechToTextAzure",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),

    AWSDetectCelebrities: new JobProfile({
        name: "AWSDetectCelebrities",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AWSDetectEmotions: new JobProfile({
        name: "AWSDetectEmotions",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    AzureExtractAllAIMetadata: new JobProfile({
        name: "AzureExtractAllAIMetadata",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    GoogleSpeechToText: new JobProfile({
        name: "GoogleSpeechToText",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
    BenchmarkSTT: new JobProfile({
        name: "BenchmarkSTT",
        inputParameters: [
            new JobParameter({ parameterName: "inputFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "referenceFile", parameterType: "Locator" }),
            new JobParameter({ parameterName: "outputLocation", parameterType: "Locator" })
        ],
        outputParameters: [
            new JobParameter({ parameterName: "outputFile", parameterType: "Locator" })
        ]
    }),
};

function createServices(terraformOutput) {
    const serviceList = [];

    for (const prop in terraformOutput) {
        if (terraformOutput.hasOwnProperty(prop)) {
            switch (prop) {
                case "ame_service_url":
                    serviceList.push(
                        new Service({
                            name: "MediaInfo AME Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "AmeJob",
                            jobProfiles: [
                                JOB_PROFILES.ExtractTechnicalMetadata.id ? JOB_PROFILES.ExtractTechnicalMetadata.id : JOB_PROFILES.ExtractTechnicalMetadata
                            ]
                        })
                    );
                    break;
                case "aws_ai_service_url":
                    serviceList.push(
                        new Service({
                            name: "AWS AI Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "AIJob",
                            jobProfiles: [
                                JOB_PROFILES.AWSTextToSpeech.id ? JOB_PROFILES.AWSTextToSpeech.id : JOB_PROFILES.AWSTextToSpeech,
                                JOB_PROFILES.AWSSsmlTextToSpeech.id ? JOB_PROFILES.AWSSsmlTextToSpeech.id : JOB_PROFILES.AWSSsmlTextToSpeech,
                                JOB_PROFILES.AWSTokenizedTextToSpeech.id ? JOB_PROFILES.AWSTokenizedTextToSpeech.id : JOB_PROFILES.AWSTokenizedTextToSpeech,
                                JOB_PROFILES.AWSTranscribeAudio.id ? JOB_PROFILES.AWSTranscribeAudio.id : JOB_PROFILES.AWSTranscribeAudio,
                                JOB_PROFILES.AWSTranslateText.id ? JOB_PROFILES.AWSTranslateText.id : JOB_PROFILES.AWSTranslateText,
                                JOB_PROFILES.AWSDetectCelebrities.id ? JOB_PROFILES.AWSDetectCelebrities.id : JOB_PROFILES.AWSDetectCelebrities,
                                JOB_PROFILES.AWSDetectEmotions.id ? JOB_PROFILES.AWSDetectEmotions.id : JOB_PROFILES.AWSDetectEmotions,
                                JOB_PROFILES.ValidateSpeechToText.id ? JOB_PROFILES.ValidateSpeechToText.id : JOB_PROFILES.ValidateSpeechToText,
                                JOB_PROFILES.CreateDubbingSrt.id ? JOB_PROFILES.CreateDubbingSrt.id : JOB_PROFILES.CreateDubbingSrt
                            ]
                        })
                    );
                    break;
                case "azure_ai_service_url":
                    serviceList.push(
                        new Service({
                            name: "AZURE AI Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "AIJob",
                            jobProfiles: [
                                JOB_PROFILES.AzureExtractAllAIMetadata.id ? JOB_PROFILES.AzureExtractAllAIMetadata.id : JOB_PROFILES.AzureExtractAllAIMetadata,
                                JOB_PROFILES.ValidateSpeechToTextAzure.id ? JOB_PROFILES.ValidateSpeechToTextAzure.id : JOB_PROFILES.ValidateSpeechToTextAzure,
                            ]
                        })
                    );
                    break;
                case "benchmarkstt_service_url":
                    serviceList.push(
                        new Service({
                            name: "BenchmarkSTT Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "QAJob",
                            jobProfiles: [
                                JOB_PROFILES.BenchmarkSTT.id,
                            ]
                        })
                    );
                    break;
                case "google_ai_service_url":
                    serviceList.push(
                        new Service({
                            name: "Google AI Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "AIJob",
                            jobProfiles: [
                                JOB_PROFILES.GoogleSpeechToText.id,
                            ]
                        })
                    );
                    break;
                case "job_processor_service_url":
                    serviceList.push(new Service({
                        name: "Job Processor Service",
                        resources: [
                            new ResourceEndpoint({
                                resourceType: "JobProcess",
                                httpEndpoint: terraformOutput[prop].value + "/job-processes"
                            })
                        ],
                        authType: "AWS4"
                    }));
                    break;
                case "job_repository_url":
                    serviceList.push(new Service({
                        name: "Job Repository",
                        resources: [
                            new ResourceEndpoint({
                                resourceType: "AmeJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "AIJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "CaptureJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "QAJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "TransferJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "TransformJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            }),
                            new ResourceEndpoint({
                                resourceType: "WorkflowJob",
                                httpEndpoint: terraformOutput[prop].value + "/jobs"
                            })
                        ],
                        authType: "AWS4"
                    }));
                    break;
                case "media_repository_url":
                    serviceList.push(new Service({
                        name: "Media Repository",
                        resources: [
                            new ResourceEndpoint({
                                resourceType: "BMContent",
                                httpEndpoint: terraformOutput[prop].value + "/bm-contents"
                            }),
                            new ResourceEndpoint({
                                resourceType: "BMEssence",
                                httpEndpoint: terraformOutput[prop].value + "/bm-essences"
                            })
                        ],
                        authType: "AWS4"
                    }));
                    break;
                case "transform_service_url":
                    serviceList.push(
                        new Service({
                            name: "FFmpeg TransformService",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "TransformJob",
                            jobProfiles: [
                                JOB_PROFILES.CreateProxyLambda.id ? JOB_PROFILES.CreateProxyLambda.id : JOB_PROFILES.CreateProxyLambda,
                                JOB_PROFILES.CreateProxyEC2.id ? JOB_PROFILES.CreateProxyEC2.id : JOB_PROFILES.CreateProxyEC2,
                                JOB_PROFILES.ExtractAudio.id ? JOB_PROFILES.ExtractAudio.id : JOB_PROFILES.ExtractAudio,
                            ],
                        })
                    );
                    break;
                case "workflow_service_url":
                    serviceList.push(
                        new Service({
                            name: "Workflow Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                }),
                                new ResourceEndpoint({
                                    resourceType: "Notification",
                                    httpEndpoint: terraformOutput["workflow_service_notification_url"].value
                                })
                            ],
                            authType: "AWS4",
                            jobType: "WorkflowJob",
                            jobProfiles: [
                                JOB_PROFILES.ConformWorkflow.id ? JOB_PROFILES.ConformWorkflow.id : JOB_PROFILES.ConformWorkflow,
                                JOB_PROFILES.AiWorkflow.id ? JOB_PROFILES.AiWorkflow.id : JOB_PROFILES.AiWorkflow
                            ]
                        })
                    );
                    break;
            }
        }
    }

    let services = {};

    for (const service of serviceList) {
        services[service.name] = service;
    }

    return services;
}

async function main() {
    const terraformOutput = JSON.parse(fs.readFileSync("./terraform.output.json", "utf8"));

    const servicesAuthType = terraformOutput["service_registry_auth_type"].value;
    const servicesAuthContext = undefined;
    const servicesUrl = terraformOutput["service_registry_url"].value + "/services";
    const jobProfilesUrl = terraformOutput["service_registry_url"].value + "/job-profiles";

    // 1. (Re)create cognito user for website
    const username = "mcma";
    const tempPassword = "b9BC9aX6B3yQK#nr";
    const password = "%bshgkUTv*RD$sR7";

    try {
        const params = {
            UserPoolId: terraformOutput["cognito_user_pool_id"].value,
            Username: "mcma"
        };

        // console.log(JSON.stringify(params, null, 2));

        await Cognito.adminDeleteUser(params).promise();
        console.log("Deleting existing user");
        // console.log(JSON.stringify(data, null, 2));
    } catch (error) {
    }

    try {
        const params = {
            UserPoolId: terraformOutput["cognito_user_pool_id"].value,
            Username: username,
            MessageAction: "SUPPRESS",
            TemporaryPassword: tempPassword
        };

        // console.log(JSON.stringify(params, null, 2));

        console.log("Creating user '" + username + "' with temporary password");
        await Cognito.adminCreateUser(params).promise();

        // console.log(JSON.stringify(data, null, 2));

        const authenticationData = {
            Username: username,
            Password: tempPassword,
        };
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        const poolData = {
            UserPoolId: terraformOutput["cognito_user_pool_id"].value,
            ClientId: terraformOutput["cognito_user_pool_client_id"].value
        };
        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        const userData = {
            Username: username,
            Pool: userPool
        };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        console.log("Authenticating user '" + username + "' with temporary password");
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function (result) {
            },

            onFailure: function (err) {
                console.log("Unexpected error:", err);
            },

            newPasswordRequired: (userAttributes, requiredAttributes) => {
                console.log("Changing temporary password to final password");
                cognitoUser.completeNewPasswordChallenge(password, requiredAttributes, {
                    onSuccess: (ignored) => {
                        console.log("User '" + username + "' is ready with password '" + password + "'");
                    },
                    onFailure: (err) => {
                        console.log("Unexpected error:", err);
                    }
                });
            }
        });
    } catch (error) {
        console.log("Failed to setup user due to error:", error);
    }

    // 2. Uploading configuration to website
    console.log("Uploading deployment configuration to website");
    const config = {
        resourceManager: {
            servicesUrl,
            servicesAuthType,
            servicesAuthContext,
        },
        aws: {
            region: terraformOutput["aws_region"].value,
            s3: {
                uploadBucket: terraformOutput["upload_bucket"].value
            },
            cognito: {
                userPool: {
                    UserPoolId: terraformOutput["cognito_user_pool_id"].value,
                    ClientId: terraformOutput["cognito_user_pool_client_id"].value
                },
                identityPool: {
                    id: terraformOutput["cognito_identity_pool_id"].value
                }
            }
        }
    };

    const s3Params = {
        Bucket: terraformOutput.website_bucket.value,
        Key: "config.json",
        Body: JSON.stringify(config)
    };
    try {
        await S3.putObject(s3Params).promise();
    } catch (error) {
        console.error(error);
        return;
    }

    // 3. Inserting / updating service registry
    try {
        // 1. Inserting / updating service registry
        let serviceRegistry = new Service({
            name: "Service Registry",
            resources: [
                new ResourceEndpoint({ resourceType: "Service", httpEndpoint: servicesUrl }),
                new ResourceEndpoint({ resourceType: "JobProfile", httpEndpoint: jobProfilesUrl })
            ],
            authType: servicesAuthType
        });

        const resourceManagerConfig = {
            servicesUrl,
            servicesAuthType,
            servicesAuthContext
        };

        const resourceManager = new ResourceManager(resourceManagerConfig, new AuthProvider().add(awsV4Auth(AWS)));

        let retrievedServices = await resourceManager.query(Service);

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

        // 2. reinitializing resourceManager
        await resourceManager.init();

        // 3. Inserting / updating job profiles
        let retrievedJobProfiles = await resourceManager.query(JobProfile);

        for (const retrievedJobProfile of retrievedJobProfiles) {
            let jobProfile = JOB_PROFILES[retrievedJobProfile.name];

            if (jobProfile && !jobProfile.id) {
                jobProfile.id = retrievedJobProfile.id;

                console.log("Updating JobProfile '" + jobProfile.name + "'");
                await resourceManager.update(jobProfile);
            } else {
                console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
                await resourceManager.delete(retrievedJobProfile);
            }
        }

        for (const jobProfileName in JOB_PROFILES) {
            let jobProfile = JOB_PROFILES[jobProfileName];
            if (!jobProfile.id) {
                console.log("Inserting JobProfile '" + jobProfile.name + "'");
                JOB_PROFILES[jobProfileName] = await resourceManager.create(jobProfile);
            }
        }

        // 4. Inserting / updating services
        const SERVICES = createServices(terraformOutput);

        retrievedServices = await resourceManager.query(Service);

        for (const retrievedService of retrievedServices) {
            if (retrievedService.name === serviceRegistry.name) {
                continue;
            }

            let service = SERVICES[retrievedService.name];

            if (service && !service.id) {
                service.id = retrievedService.id;

                console.log("Updating Service '" + service.name + "'");
                await resourceManager.update(service);
            } else {
                console.log("Removing " + (service && service.id ? "duplicate " : "") + "Service '" + retrievedService.name + "'");
                await resourceManager.delete(retrievedService);
            }
        }

        for (const serviceName in SERVICES) {
            if (SERVICES.hasOwnProperty(serviceName)) {
                let service = SERVICES[serviceName];
                if (!service.id) {
                    console.log("Inserting Service '" + service.name + "'");
                    SERVICES[serviceName] = await resourceManager.create(service);
                }
            }
        }
    } catch (error) {
        if (error.response) {
            console.error(JSON.stringify(error.response.data.message, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(ignored => console.log("Done")).catch(error => console.error(error));
