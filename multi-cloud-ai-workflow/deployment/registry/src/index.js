//"use strict";

const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');
const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Cognito = new AWS.CognitoIdentityServiceProvider();
const CognitoAdminCreateUser = util.promisify(Cognito.adminCreateUser.bind(Cognito));
const CognitoAdminDeleteUser = util.promisify(Cognito.adminDeleteUser.bind(Cognito));

global.fetch = require('node-fetch');
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

const MCMA_CORE = require("mcma-core");

const authenticator = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
	sessionToken: AWS.config.credentials.sessionToken,
	region: AWS.config.region
});

const JOB_PROFILES = {
    ConformWorkflow: new MCMA_CORE.JobProfile(
        "ConformWorkflow",
        [
            new MCMA_CORE.JobParameter("metadata", "DescriptiveMetadata"),
            new MCMA_CORE.JobParameter("inputFile", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("websiteMediaFile", "Locator"),
            new MCMA_CORE.JobParameter("aiWorkflow", "WorkflowJob"),
            new MCMA_CORE.JobParameter("bmContent", "BMContent")
        ]
    ),
    AiWorkflow: new MCMA_CORE.JobProfile(
        "AiWorkflow",
        [
            new MCMA_CORE.JobParameter("bmContent", "BMContent"),
            new MCMA_CORE.JobParameter("bmEssence", "BMEssence")
        ]
    ),
    ExtractTechnicalMetadata: new MCMA_CORE.JobProfile(
        "ExtractTechnicalMetadata",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    CreateProxyLambda: new MCMA_CORE.JobProfile(
        "CreateProxyLambda",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    CreateProxyEC2: new MCMA_CORE.JobProfile(
        "CreateProxyEC2",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    ExtractThumbnail: new MCMA_CORE.JobProfile(
        "ExtractThumbnail",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("ebucore:width"),
            new MCMA_CORE.JobParameter("ebucore:height")
        ]
    ),
    AWSTranscribeAudio: new MCMA_CORE.JobProfile(
        "AWSTranscribeAudio",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    AWSTranslateText: new MCMA_CORE.JobProfile(
        "AWSTranslateText",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("targetLanguageCode", "awsLanguageCode"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("sourceLanguageCode", "awsLanguageCode")
        ]
    ),
    AWSDetectCelebrities: new MCMA_CORE.JobProfile(
        "AWSDetectCelebrities",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    AzureExtractAllAIMetadata: new MCMA_CORE.JobProfile(
        "AzureExtractAllAIMetadata",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
}

const createServices = (serviceUrls) => {
    const serviceList = [];

    for (const prop in serviceUrls) {
        switch (prop) {
            case "ame_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "MediaInfo AME Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "AmeJob",
                        [
                            JOB_PROFILES.ExtractTechnicalMetadata.id ? JOB_PROFILES.ExtractTechnicalMetadata.id : JOB_PROFILES.ExtractTechnicalMetadata
                        ]
                    )
                );
                break;
            case "aws_ai_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "AWS AI Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "AIJob",
                        [
                            JOB_PROFILES.AWSTranscribeAudio.id ? JOB_PROFILES.AWSTranscribeAudio.id : JOB_PROFILES.AWSTranscribeAudio,
                            JOB_PROFILES.AWSTranslateText.id ? JOB_PROFILES.AWSTranslateText.id : JOB_PROFILES.AWSTranslateText,
                            JOB_PROFILES.AWSDetectCelebrities.id ? JOB_PROFILES.AWSDetectCelebrities.id : JOB_PROFILES.AWSDetectCelebrities
                        ]
                    )
                );
                break;
            case "azure_ai_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "AZURE AI Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "AIJob",
                        [
                            //JOB_PROFILES.TranscribeAudio.id ? JOB_PROFILES.TranscribeAudio.id : JOB_PROFILES.TranscribeAudio,   //Will be implemented at a later time and may need to be renamed to not conflict with AWS
                            //JOB_PROFILES.TranslateText.id ? JOB_PROFILES.TranslateText.id : JOB_PROFILES.TranslateText,
                            JOB_PROFILES.AzureExtractAllAIMetadata.id ? JOB_PROFILES.AzureExtractAllAIMetadata.id : JOB_PROFILES.AzureExtractAllAIMetadata

                        ]
                    )
                );
                break;
            case "job_processor_service_url":
                serviceList.push(new MCMA_CORE.Service(
                    "Job Processor Service",
                    [
                        new MCMA_CORE.ServiceResource("JobProcess", serviceUrls[prop] + "/job-processes")
                    ]
                ));
                break;
            case "job_repository_url":
                serviceList.push(new MCMA_CORE.Service(
                    "Job Repository",
                    [
                        new MCMA_CORE.ServiceResource("AmeJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("AIJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("CaptureJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("QAJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("TransferJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("TransformJob", serviceUrls[prop] + "/jobs"),
                        new MCMA_CORE.ServiceResource("WorkflowJob", serviceUrls[prop] + "/jobs")
                    ]
                ));
                break;
            case "media_repository_url":
                serviceList.push(new MCMA_CORE.Service(
                    "Media Repository",
                    [
                        new MCMA_CORE.ServiceResource("BMContent", serviceUrls[prop] + "/bm-contents"),
                        new MCMA_CORE.ServiceResource("BMEssence", serviceUrls[prop] + "/bm-essences")
                    ]
                ));
                break;
            case "transform_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "FFmpeg TransformService",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "TransformJob",
                        [
                            JOB_PROFILES.CreateProxyLambda.id ? JOB_PROFILES.CreateProxyLambda.id : JOB_PROFILES.CreateProxyLambda,
                            JOB_PROFILES.CreateProxyEC2.id ? JOB_PROFILES.CreateProxyEC2.id : JOB_PROFILES.CreateProxyEC2,
                        ]
                    )
                );
                break;
            case "workflow_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "Workflow Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "WorkflowJob",
                        [
                            JOB_PROFILES.ConformWorkflow.id ? JOB_PROFILES.ConformWorkflow.id : JOB_PROFILES.ConformWorkflow,
                            JOB_PROFILES.AiWorkflow.id ? JOB_PROFILES.AiWorkflow.id : JOB_PROFILES.AiWorkflow
                            // ],
                            // [
                            //     new MCMA_CORE.Locator({ "httpEndpoint" : serviceUrls.publicBucketUrl, "awsS3Bucket": serviceUrls.publicBucket }),
                            //     new MCMA_CORE.Locator({ "httpEndpoint" : serviceUrls.privateBucketUrl, "awsS3Bucket": serviceUrls.privateBucket })
                            // ],
                            // [
                            //     new MCMA_CORE.Locator({ "httpEndpoint" : serviceUrls.publicBucketUrl, "awsS3Bucket": serviceUrls.publicBucket }),
                            //     new MCMA_CORE.Locator({ "httpEndpoint" : serviceUrls.privateBucketUrl, "awsS3Bucket": serviceUrls.privateBucket })
                        ]
                    )
                );
                break;
        }
    }

    var services = {};

    for (const service of serviceList) {
        services[service.name] = service;
    }

    return services;
}

const readStdin = async () => {
    let content = "";

    process.stdin.on('data', (data) => {
        content += data.toString();
    });

    return await new Promise((resolve, reject) => {
        process.stdin.on('end', () => resolve(content));
        process.stdin.on('error', reject);
    });
}

const parseContent = (content) => {
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
    let content = await readStdin();
    let terraformOutput = parseContent(content);

    let servicesUrl = terraformOutput.service_registry_url + "/services";
    let jobProfilesUrl = terraformOutput.service_registry_url + "/job-profiles";

    // 1. (Re)create cognito user for website
    let username = "mcma";
    let tempPassword = "b9BC9aX6B3yQK#nr";
    let password = "%bshgkUTv*RD$sR7";

    try {
        var params = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            Username: "mcma"
        }

        // console.log(JSON.stringify(params, null, 2));

        let data = await CognitoAdminDeleteUser(params);
        console.log("Deleting existing user");
        // console.log(JSON.stringify(data, null, 2));
    } catch (error) {
    }

    try {
        var params = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            Username: username,
            MessageAction: "SUPPRESS",
            TemporaryPassword: tempPassword
        }

        // console.log(JSON.stringify(params, null, 2));

        console.log("Creating user '" + username + "' with temporary password");
        let data = await CognitoAdminCreateUser(params);

        // console.log(JSON.stringify(data, null, 2));

        var authenticationData = {
            Username: username,
            Password: tempPassword,
        };
        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        var poolData = {
            UserPoolId: terraformOutput.cognito_user_pool_id,
            ClientId: terraformOutput.cognito_user_pool_client_id
        };
        var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        var userData = {
            Username: username,
            Pool: userPool
        };
        var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

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
                    onSuccess: (session) => {
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
    let config = {
        servicesUrl: servicesUrl,
        aws: {
            region: terraformOutput.aws_region,
            s3: {
                uploadBucket: terraformOutput.upload_bucket
            },
            cognito: {
                userPool: {
                    UserPoolId: terraformOutput.cognito_user_pool_id,
                    ClientId: terraformOutput.cognito_user_pool_client_id
                },
                identityPool: {
                    id: terraformOutput.cognito_identity_pool_id
                }
            }
        }
    }

    let s3Params = {
        Bucket: terraformOutput.website_bucket,
        Key: "config.json",
        Body: JSON.stringify(config)
    }
    try {
        await S3PutObject(s3Params);
    } catch (error) {
        console.error(error);
        return;
    }

    // 3. Inserting / updating service registry
    let serviceRegistry = new MCMA_CORE.Service("Service Registry", [
        new MCMA_CORE.ServiceResource("Service", servicesUrl),
        new MCMA_CORE.ServiceResource("JobProfile", jobProfilesUrl)
    ]);

    let resourceManager = new MCMA_CORE.ResourceManager(servicesUrl, authenticator);
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

    // 4. reinitializing resourceManager
    await resourceManager.init();

    // 5. Inserting / updating job profiles
    let retrievedJobProfiles = await resourceManager.get("JobProfile");

    for (const retrievedJobProfile of retrievedJobProfiles) {
        let jobProfile = JOB_PROFILES[retrievedJobProfile.name];

        if (jobProfile && !jobProfile.id) {
            jobProfile.id = retrievedJobProfile.id;

            console.log("Updating JobProfile '" + jobProfile.name + "'");
            await resourceManager.update(jobProfile);
        } else {
            console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
            //await resourceManager.delete(jobProfile[i]);
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

    // 6. Inserting / updating services
    const SERVICES = createServices(terraformOutput);

    retrievedServices = await resourceManager.get("Service");

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
        let service = SERVICES[serviceName];
        if (!service.id) {
            console.log("Inserting Service '" + service.name + "'");
            SERVICES[serviceName] = await resourceManager.create(service);
        }
    };
}
main();