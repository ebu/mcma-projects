import { Component, OnInit, OnDestroy } from '@angular/core';

import { ConfigService } from '../services/config.service';
import { McmaClientService } from '../services/mcma-client.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'mcma-services',
    templateUrl: './services.component.html',
    styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit, OnDestroy {

    services = [];
    selectedService;

    jobProfiles = {};
    filteredJobProfiles = [];

    serviceResources = [];
    selectedServiceResource;

    resources = [];
    selectedResource;
    selectedResourceText;

    servicesDisplayedColumns = ['name', 'accepts', 'created', 'modified'];
    jobProfilesDisplayedColumns = ['name', 'input', 'output']
    serviceResourcesDisplayedColumns = ['type', 'url']
    resourcesDisplayedColumns = ['type', 'name', 'created', 'modified'];
    resourceManager: any;

    resourceManagerSubscription: Subscription;

    constructor(private configService: ConfigService, private mcmaClientService: McmaClientService) { }

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
        let services = await this.resourceManager.get("Service");

        this.services = services.sort((a, b) => a.name.localeCompare(b.name));

        let jobProfiles = await this.resourceManager.get("JobProfile");

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
            jobProfile.input = input;

            let output = "";
            if (jobProfile.outputParameters) {
                for (const param of jobProfile.outputParameters) {
                    if (output) {
                        output += ", ";
                    }
                    output += param.parameterName;
                }
            }
            jobProfile.output = output;

            this.jobProfiles[jobProfile.id] = jobProfile;
        }

        this.selectService(this.services[0]);
    }

    selectService(row) {
        this.selectedService = row;
        console.log(row);

        let filteredJobProfiles = [];
        let serviceResources = [];

        if (this.selectedService) {
            if (this.selectedService.jobProfiles) {
                for (let jobProfileId of this.selectedService.jobProfiles) {
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
        let resourceEndpoint = await this.resourceManager.getResourceEndpoint(httpEndpoint);

        if (resourceEndpoint) {
            let response = await resourceEndpoint.get(httpEndpoint)
            this.resources = response.data.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
        } else {
            this.resources.length = 0;
        }
    }

    selectResource(row) {
        this.selectedResource = row;
        this.selectedResourceText = row ? JSON.stringify(row, null, 2) : "";
    }
}
