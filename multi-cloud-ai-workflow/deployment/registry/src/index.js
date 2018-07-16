const MCMA_CORE = require("mcma-core");

const JOB_PROFILES = {
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
    ExtractAIMetadata: new MCMA_CORE.JobProfile(
        "ExtractAIMetadata",
        [
            new MCMA_CORE.JobParameter("inputFile", "Locator"),
            new MCMA_CORE.JobParameter("outputLocation", "Locator")
        ],
        [
            new MCMA_CORE.JobParameter("outputFile", "Locator")
        ]
    ),
    CreateProxy: new MCMA_CORE.JobProfile(
        "CreateProxy",
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
}

const createServices = (serviceUrls) => {
    var serviceList = [];

    for (var prop in serviceUrls) {
        switch (prop) {
            case "ame_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "MediaInfo AME Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "job-assignments")
                        ],
                        "AmeJob",
                        [
                            JOB_PROFILES.ExtractTechnicalMetadata.id ? JOB_PROFILES.ExtractTechnicalMetadata.id : JOB_PROFILES.ExtractTechnicalMetadata
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
            case "ai_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "AI Service",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "job-assignments")
                        ],
                        "AIJob",
                        [
                            JOB_PROFILES.ExtractAIMetadata.id ? JOB_PROFILES.ExtractAIMetadata.id : JOB_PROFILES.ExtractAIMetadata
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
                        new MCMA_CORE.ServiceResource("ebucore:BMContent", serviceUrls[prop] + "/bm-contents"),
                        new MCMA_CORE.ServiceResource("ebucore:BMEssence", serviceUrls[prop] + "/bm-essences")
                    ]
                ));
                break;
            case "transform_service_url":
                serviceList.push(
                    new MCMA_CORE.Service(
                        "FFmpeg TransformService",
                        [
                            new MCMA_CORE.ServiceResource("JobAssignment", serviceUrls[prop] + "job-assignments")
                        ],
                        "TransformJob",
                        [
                            JOB_PROFILES.CreateProxy.id ? JOB_PROFILES.CreateProxy.id : JOB_PROFILES.CreateProxy,
                            JOB_PROFILES.ExtractThumbnail.id ? JOB_PROFILES.ExtractThumbnail.id : JOB_PROFILES.ExtractThumbnail
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

    serviceList.forEach(service => {
        services[service.name] = service;
    });

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
    lines.forEach(line => {
        var parts = line.split(" = ");

        if (parts.length === 2) {
            serviceUrls[parts[0]] = parts[1];
        }
    });

    return serviceUrls;
}

const main = async () => {
    let content = await readStdin();
    let serviceUrls = parseContent(content);

    let servicesUrl = serviceUrls.service_registry_url + "/services";
    let jobProfilesUrl = serviceUrls.service_registry_url + "/job-profiles";

    // 1. Inserting / updating service registry
    let serviceRegistry = new MCMA_CORE.Service("Service Registry", [
        new MCMA_CORE.ServiceResource("Service", servicesUrl),
        new MCMA_CORE.ServiceResource("JobProfile", jobProfilesUrl)
    ]);

    let resourceManager = new MCMA_CORE.ResourceManager(servicesUrl);
    let retrievedServices = await resourceManager.get("Service");

    for (retrievedService of retrievedServices) {
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

    for (retrievedJobProfile of retrievedJobProfiles) {
        let jobProfile = JOB_PROFILES[retrievedJobProfile.name];

        if (jobProfile && !jobProfile.id) {
            jobProfile.id = retrievedJobProfile.id;

            console.log("Updating JobProfile '" + jobProfile.name + "'");
            await resourceManager.update(jobProfile);
        } else {
            console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
            await resourceManager.delete(jobProfile[i]);
        }
    }

    for (jobProfileName in JOB_PROFILES) {
        let jobProfile = JOB_PROFILES[jobProfileName];
        if (!jobProfile.id) {
            console.log("Inserting JobProfile '" + jobProfile.name + "'");
            JOB_PROFILES[jobProfileName] = await resourceManager.create(jobProfile);
        }
    }

    // 4. Inserting / updating services
    const SERVICES = createServices(serviceUrls);
    
    retrievedServices = await resourceManager.get("Service");

    for (retrievedService of retrievedServices) {
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

    for (serviceName in SERVICES) {
        let service = SERVICES[serviceName];
        if (!service.id) {
            console.log("Inserting Service '" + service.name + "'");
            SERVICES[serviceName] = await resourceManager.create(service);
        }
    };
}
main();