//"use strict";

const util = require("util");

const AWS = require("aws-sdk");
AWS.config.loadFromPath('./aws-credentials.json');
const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_CORE = require("mcma-core");

const JOB_PROFILES = {
    ConformWorkflow: new MCMA_CORE.JobProfile(
        "ConformWorkflow",
        [
            new MCMA_CORE.JobParameter("metadata", "DescriptiveMetadata"),
            new MCMA_CORE.JobParameter("inputFile", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("websiteMediaFile", "Locator"),
            new MCMA_CORE.JobParameter("aiWorkflow", "WorkflowJob")
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
    TranscribeAudio: new MCMA_CORE.JobProfile(
        "TranscribeAudio",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    TranslateText: new MCMA_CORE.JobProfile(
        "TranslateText",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    ExtractAllAIMetadata: new MCMA_CORE.JobProfile(
        "ExtractAllAIMetadata",
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
                            JOB_PROFILES.TranscribeAudio.id ? JOB_PROFILES.TranscribeAudio.id : JOB_PROFILES.TranscribeAudio,
                            JOB_PROFILES.TranslateText.id ? JOB_PROFILES.TranslateText.id : JOB_PROFILES.TranslateText
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
                            JOB_PROFILES.ExtractAllAIMetadata.id ? JOB_PROFILES.ExtractAllAIMetadata.id : JOB_PROFILES.ExtractAllAIMetadata
                            
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
            case "transform_service_lambda_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "FFmpeg Lambda TransformService",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "TransformJob",
                        [
                            JOB_PROFILES.CreateProxyLambda.id ? JOB_PROFILES.CreateProxyLambda.id : JOB_PROFILES.CreateProxyLambda,
                        ]
                    )
                );
                break;
            case "transform_service_ec2_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "FFmpeg EC2 TransformService",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "/job-assignments")
                        ],
                        "TransformJob",
                        [
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
    let serviceUrls = parseContent(content);

    let servicesUrl = serviceUrls.service_registry_url + "/services";
    let jobProfilesUrl = serviceUrls.service_registry_url + "/job-profiles";

    console.log("Uploading deployment configuration to website");
    let config = {
        servicesUrl: servicesUrl,
        uploadBucket: serviceUrls.upload_bucket
    }

    let s3Params = {
        Bucket: serviceUrls.website_bucket,
        Key: "config.json",
        Body: JSON.stringify(config)
    }
    try {
        await S3PutObject(s3Params);
    } catch (error) {
        console.error(error);
        return;
    }

    // 1. Inserting / updating service registry
    let serviceRegistry = new MCMA_CORE.Service("Service Registry", [
        new MCMA_CORE.ServiceResource("Service", servicesUrl),
        new MCMA_CORE.ServiceResource("JobProfile", jobProfilesUrl)
    ]);

    let resourceManager = new MCMA_CORE.ResourceManager(servicesUrl);
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

    // 2. reinitializing resourceManager
    await resourceManager.init();

    // 3. Inserting / updating job profiles
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

    // 4. Inserting / updating services
    const SERVICES = createServices(serviceUrls);

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