import { Component, OnDestroy, OnInit } from "@angular/core";
import { JobProfile, Service } from "@mcma/core";
import { ResourceManager } from "@mcma/client";

import { ConfigService } from "../services/config.service";
import { McmaClientService } from "../services/mcma-client.service";
import { Subscription } from "rxjs";
import { QueryResults } from "@mcma/data";

@Component({
    selector: "mcma-services",
    templateUrl: "./services.component.html",
    styleUrls: ["./services.component.scss"]
})
export class ServicesComponent implements OnInit, OnDestroy {

    services: Service[] = [];
    selectedService: Service;

    jobProfiles = {};
    filteredJobProfiles = [];

    serviceResources = [];
    selectedServiceResource;

    resources = [];
    selectedResource;
    selectedResourceText;

    servicesDisplayedColumns = ["name", "accepts", "created", "modified"];
    jobProfilesDisplayedColumns = ["name", "input", "output"];
    serviceResourcesDisplayedColumns = ["type", "url"];
    resourcesDisplayedColumns = ["type", "name", "created", "modified"];
    resourceManager: ResourceManager;

    resourceManagerSubscription: Subscription;

    constructor(private configService: ConfigService, private mcmaClientService: McmaClientService) {
    }

    ngOnInit() {
        this.resourceManagerSubscription = this.mcmaClientService.resourceManager$.subscribe(resourceManager => {
            this.resourceManager = resourceManager;
            if (this.resourceManager) {
                this.initialize();
            }
        });
    }

    ngOnDestroy() {
        if (this.resourceManagerSubscription) {
            this.resourceManagerSubscription.unsubscribe();
            this.resourceManagerSubscription = null;
        }
    }

    private initialize = async () => {
        console.log("[ServicesComponent] getting services", this.resourceManager, Service.name);
        const services = await this.resourceManager.query<Service>("Service");
        console.log("[ServicesComponent] retrieved services", services);

        this.services = services.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[ServicesComponent] sorted services", this.services);

        console.log("[ServicesComponent] getting job profiles", this.resourceManager, JobProfile.name);
        const jobProfiles = await this.resourceManager.query<JobProfile>("JobProfile");
        console.log("[ServicesComponent] retrieved job profiles", jobProfiles);

        this.jobProfiles = {};

        for (const jobProfile of jobProfiles) {

            let input = "";
            if (jobProfile.inputParameters) {
                for (const param of jobProfile.inputParameters) {
                    if (input) {
                        input += ", ";
                    }
                    input += param.parameterName;
                }
            }
            (<any>jobProfile).input = input;

            let output = "";
            if (jobProfile.outputParameters) {
                for (const param of jobProfile.outputParameters) {
                    if (output) {
                        output += ", ";
                    }
                    output += param.parameterName;
                }
            }
            (<any>jobProfile).output = output;

            this.jobProfiles[jobProfile.id] = jobProfile;
        }
        console.log("[ServicesComponent] processed job profiles", this.jobProfiles);

        this.selectService(this.services[0]);
    };

    selectService(row: Service) {
        this.selectedService = row;
        console.log(row);

        const filteredJobProfiles = [];
        const serviceResources = [];

        if (this.selectedService) {
            if (this.selectedService.jobProfileIds) {
                for (const jobProfileId of this.selectedService.jobProfileIds) {
                    filteredJobProfiles.push(this.jobProfiles[jobProfileId]);
                }
            }

            if (this.selectedService.resources) {
                serviceResources.push(...this.selectedService.resources);
            }
        }

        this.filteredJobProfiles = filteredJobProfiles.sort((a, b) => a.name.localeCompare(b.name));
        this.serviceResources = serviceResources.sort((a, b) => a.resourceType.localeCompare(b.resourceType));

        this.selectServiceResource(null);
    }

    selectServiceResource(row) {
        this.selectedServiceResource = row;

        this.resources = [];
        this.selectResource(null);

        if (this.selectedServiceResource) {
            this.getResources(this.selectedServiceResource.httpEndpoint);
        }
    }

    private getResources = async (httpEndpoint) => {
        const resourceEndpoint = await this.resourceManager.getResourceEndpointClient(httpEndpoint);

        if (resourceEndpoint) {
            const response = await resourceEndpoint.get<QueryResults<any>>(httpEndpoint);
            this.resources = response.data.results.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
        } else {
            this.resources.length = 0;
        }
    };

    selectResource(row) {
        this.selectedResource = row;
        this.selectedResourceText = row ? JSON.stringify(row, null, 2) : "";
    }
}
