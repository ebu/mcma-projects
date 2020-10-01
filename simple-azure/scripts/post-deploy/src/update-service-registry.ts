import { JobProfile, ResourceEndpoint, Service } from "@mcma/core";
import { ResourceManager } from "@mcma/client";

import * as serviceData from "./services.json";
import * as jobProfileData from "./job-profiles.json";

export async function updateServiceRegistry(resourceManager: ResourceManager, terraformOutput: any): Promise<ResourceManager> {
    const servicesAuthContext = { scope: `${terraformOutput.service_registry_url.value}/.default` };
    const servicesUrl = terraformOutput.service_registry_url.value + "/services";
    const jobProfilesUrl = terraformOutput.service_registry_url.value + "/job-profiles";

    let retrievedServices = await resourceManager.query(Service);

    // 1. Inserting / updating service registry
    let serviceRegistry = new Service({
        name: "Service Registry",
        resources: [
            new ResourceEndpoint({ resourceType: "Service", httpEndpoint: servicesUrl }),
            new ResourceEndpoint({ resourceType: "JobProfile", httpEndpoint: jobProfilesUrl })
        ],
        authType: "AzureAD",
        authContext: servicesAuthContext
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
        let jobProfile = jobProfileData[retrievedJobProfile.name];

        if (jobProfile && !jobProfile.id) {
            jobProfile.id = retrievedJobProfile.id;

            console.log("Updating JobProfile '" + jobProfile.name + "'");
            await resourceManager.update(jobProfile);
        } else {
            console.log("Removing " + (jobProfile && jobProfile.id ? "duplicate " : "") + "JobProfile '" + retrievedJobProfile.name + "'");
            await resourceManager.delete(retrievedJobProfile);
        }
    }

    for (const jobProfileName of Object.keys(jobProfileData)) {
        let jobProfile = jobProfileData[jobProfileName];
        if (!jobProfile.id) {
            console.log("Inserting JobProfile '" + jobProfile.name + "'");
            jobProfileData[jobProfileName] = await resourceManager.create(jobProfile);
        }
    }

    // 4. Inserting / updating services
    const services = createServices(terraformOutput);

    retrievedServices = await resourceManager.query(Service);

    for (const retrievedService of retrievedServices) {
        if (retrievedService.name === serviceRegistry.name) {
            continue;
        }

        let service = services[retrievedService.name];

        if (service && !service.id) {
            service.id = retrievedService.id;

            console.log("Updating Service '" + service.name + "'");
            await resourceManager.update(service);
        } else {
            console.log("Removing " + (service && service.id ? "duplicate " : "") + "Service '" + retrievedService.name + "'");
            await resourceManager.delete(retrievedService);
        }
    }

    for (const serviceName of Object.keys(services)) {
        let service = services[serviceName];
        if (!service.id) {
            console.log("Inserting Service '" + service.name + "'");
            services[serviceName] = await resourceManager.create(service);
        }
    }

    // reinitializing resource manager
    await resourceManager.init();

    return resourceManager;
}

function createServices(terraformOutput: { [key: string]: any }) {
    const services = {};

    for (const prop of Object.keys(terraformOutput)) {
        const serviceJson = serviceData[prop];
        if (!serviceJson) {
            continue;
        }

        let baseUrl =
            terraformOutput[prop].value.endsWith("/")
                ? terraformOutput[prop].value.substr(0, terraformOutput[prop].value.length - 1)
                : terraformOutput[prop].value;

        for (const resourceEndpoint of serviceJson.resources) {
            resourceEndpoint.httpEndpoint = baseUrl + resourceEndpoint.httpEndpoint;
        }

        serviceJson.authContext.scope = baseUrl + serviceJson.authContext.scope;

        if (serviceJson.jobProfileIds && serviceJson.jobProfileIds.length > 0) {
            const jobProfileIds = [];
            for (const jobProfileName of serviceJson.jobProfileIds) {
                const jobProfileJson = jobProfileData[jobProfileName];
                if (jobProfileJson) {
                    jobProfileIds.push(jobProfileJson.id);
                }
            }
            serviceJson.jobProfileIds = jobProfileIds;
        }

        services[serviceJson.name] = serviceJson;
    }
    
    return services;
}
