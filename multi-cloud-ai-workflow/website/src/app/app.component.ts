import { Component, OnInit } from '@angular/core';

import { promisify } from "es6-promisify";

import MCMA_CORE from "mcma-core";
import xml2js from "xml2js";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    title = 'MCMA';
    content = 'content'

    config: any = {};

    itemsList: any[] = []

    workflowJob: any;

    ngOnInit(): void {
        this.initialize();
    }

    async initialize() {
        try {
            // loading config from config.json
            let response = await MCMA_CORE.HTTP.get("./config.json");
            this.config = response.data;

            this.content = JSON.stringify(response.data)

            // list objects from upload bucket
            response = await MCMA_CORE.HTTP.get("/" + this.config.uploadBucket);
            console.log(response.data);
            this.content = response.data;

            // convert xml to json
            const parseString = promisify(xml2js.parseString);
            let json = await parseString(response.data, { trim: true, explicitArray: false });
            console.log(json);

            // extract items into list
            this.itemsList = json.ListBucketResult.Contents
            if (!Array.isArray(this.itemsList)) {
                this.itemsList = [this.itemsList];
            }

            this.content = JSON.stringify(this.itemsList, null, 2);
        } catch (error) {
            this.content = "Failed to initalize due to '" + error.message + "'";
        }
    }

    async startWorkflow() {
        console.log("startWorkflow()")
        // sending first one as the workflow: TODO implement selection of item
        if (this.itemsList.length) {

            try {
                console.log(this.config);

                let resourceManager = new MCMA_CORE.ResourceManager(this.config.servicesUrl);

                // get all job profiles
                let jobProfiles = await resourceManager.get("JobProfile");

                let jobProfileId;

                // find job profile with correct name
                for (const jobProfile of jobProfiles) {
                    if (jobProfile.name === "ConformWorkflow") {
                        jobProfileId = jobProfile.id;
                        break;
                    }
                }

                // if not found bail out
                if (!jobProfileId) {
                    throw new Error("JobProfile 'ConformWorkflow' not found");
                }

                // creating workflow job
                let workflowJob = new MCMA_CORE.WorkflowJob(
                    jobProfileId,
                    new MCMA_CORE.JobParameterBag({
                        metadata: new MCMA_CORE.DescriptiveMetadata({
                            "name": "Test video",
                            "description": "Description of test video"
                        }),
                        inputFile: new MCMA_CORE.Locator({
                            awsS3Bucket: this.config.uploadBucket,
                            awsS3Key: this.itemsList[0].Key
                        })
                    })
                );

                // posting the workflowJob to the job repository
                this.workflowJob = await resourceManager.create(workflowJob);

                console.log(JSON.stringify(this.workflowJob, null, 2));
            } catch (error) {
                console.error(error);
            }
        }
    }
}
