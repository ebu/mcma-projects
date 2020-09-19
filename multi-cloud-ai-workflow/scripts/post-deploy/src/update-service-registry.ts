import { JobParameter, JobProfile, ResourceEndpoint, Service } from "@mcma/core";
import { AuthProvider, ResourceManager, ResourceManagerConfig } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

export async function updateServiceRegistry(AWS: any, terraformOutput: any): Promise<ResourceManager> {
    const servicesUrl = terraformOutput.service_registry.value.services_url;
    const jobProfilesUrl = terraformOutput.service_registry.value.job_profiles_url;
    const servicesAuthType = terraformOutput.service_registry.value.auth_type;

    const resourceManagerConfig: ResourceManagerConfig = {
        servicesUrl,
        servicesAuthType
    };

    const resourceManager = new ResourceManager(resourceManagerConfig, new AuthProvider().add(awsV4Auth(AWS)));

    let retrievedServices = await resourceManager.query(Service);

    // 1. Inserting / updating service registry
    let serviceRegistry = new Service({
        name: "Service Registry",
        resources: [
            new ResourceEndpoint({ resourceType: "Service", httpEndpoint: servicesUrl }),
            new ResourceEndpoint({ resourceType: "JobProfile", httpEndpoint: jobProfilesUrl })
        ],
        authType: servicesAuthType
    });

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
        let jobProfile = JobProfiles[retrievedJobProfile.name];

        if (jobProfile && !jobProfile.id) {
            jobProfile.id = retrievedJobProfile.id;

            console.log("Updating JobProfile '" + jobProfile.name + "'");
            await resourceManager.update(jobProfile);
        } else {
            console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
            await resourceManager.delete(retrievedJobProfile);
        }
    }

    for (const jobProfileName in JobProfiles) {
        let jobProfile = JobProfiles[jobProfileName];
        if (!jobProfile.id) {
            console.log("Inserting JobProfile '" + jobProfile.name + "'");
            JobProfiles[jobProfileName] = await resourceManager.create(jobProfile);
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

    // reinitializing resource manager
    await resourceManager.init();

    return resourceManager;
}

function createServices(terraformOutput: any) {
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
                            jobProfileIds: [
                                JobProfiles.ExtractTechnicalMetadata.id
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
                            jobProfileIds: [
                                JobProfiles.AWSTextToSpeech.id,
                                JobProfiles.AWSSsmlTextToSpeech.id,
                                JobProfiles.AWSTokenizedTextToSpeech.id,
                                JobProfiles.AWSTranscribeAudio.id,
                                JobProfiles.AWSTranslateText.id,
                                JobProfiles.AWSDetectCelebrities.id,
                                JobProfiles.AWSDetectEmotions.id,
                                JobProfiles.CreateDubbingSrt.id
                            ]
                        })
                    );
                    break;
                case "azure_ai_service_url":
                    serviceList.push(
                        new Service({
                            name: "Azure AI Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "AIJob",
                            jobProfileIds: [
                                JobProfiles.AzureExtractAllAIMetadata.id,
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
                            jobProfileIds: [
                                JobProfiles.BenchmarkSTT.id,
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
                            jobProfileIds: [
                                JobProfiles.GoogleSpeechToText.id,
                            ]
                        })
                    );
                    break;
                case "job_processor":
                    serviceList.push(new Service({
                        name: "Job Processor",
                        resources: [
                            new ResourceEndpoint({
                                resourceType: "AmeJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "AIJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "CaptureJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "DistributionJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "QAJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "TransferJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "TransformJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            }),
                            new ResourceEndpoint({
                                resourceType: "WorkflowJob",
                                httpEndpoint: terraformOutput[prop].value.jobs_url
                            })
                        ],
                        authType: terraformOutput[prop].value.auth_type
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
                            name: "FFmpeg Transform Service",
                            resources: [
                                new ResourceEndpoint({
                                    resourceType: "JobAssignment",
                                    httpEndpoint: terraformOutput[prop].value + "/job-assignments"
                                })
                            ],
                            authType: "AWS4",
                            jobType: "TransformJob",
                            jobProfileIds: [
                                JobProfiles.CreateProxyLambda.id,
                                JobProfiles.CreateProxyEC2.id,
                                JobProfiles.ExtractAudio.id,
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
                            jobProfileIds: [
                                JobProfiles.ConformWorkflow.id,
                                JobProfiles.AiWorkflow.id
                            ]
                        })
                    );
                    break;
            }
        }
    }

    let services: { [key: string]: Service } = {};

    for (const service of serviceList) {
        services[service.name] = service;
    }

    return services;
}


const JobProfiles: { [key: string]: JobProfile } = {
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
            new JobParameter({ parameterName: "ebucore:width", parameterType: "number" }),
            new JobParameter({ parameterName: "ebucore:height", parameterType: "number" })
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
