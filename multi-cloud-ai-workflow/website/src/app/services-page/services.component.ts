import { Component, OnInit } from '@angular/core';
import { ConfigService } from '../services/config.service';

import { ResourceManager, HTTP } from "mcma-core"

@Component({
    selector: 'mcma-services',
    templateUrl: './services.component.html',
    styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit {

    private servicesUrl;

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

    constructor(private configService: ConfigService) { }

    ngOnInit() {
        this.configService.get<string>('servicesUrl', "AAAAAAAAAAAAAAAAAAAAAA").subscribe(servicesUrl => {
            this.servicesUrl = servicesUrl;
            this.initialize();
        })
    }

    private initialize = async () => {
        let resourceManager = new ResourceManager(this.servicesUrl);

        let services = await resourceManager.get("Service");

        this.services = services.sort((a, b) => a.name.localeCompare(b.name));

        let jobProfiles = await resourceManager.get("JobProfile");

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
        let response = await HTTP.get(httpEndpoint);
        this.resources = response.data.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
    }

    selectResource(row) {
        this.selectedResource = row;
        this.selectedResourceText = row ? JSON.stringify(row, null, 2) : "";
    }
}
