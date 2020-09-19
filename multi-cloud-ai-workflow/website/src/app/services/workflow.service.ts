import { Injectable } from "@angular/core";
import { BehaviorSubject, from, Observable, Subject, timer } from "rxjs";
import { map, switchMap, takeWhile, zip } from "rxjs/operators";

import { v4 as uuidv4 } from "uuid";

import { JobParameterBag, JobProfile, McmaTracker, WorkflowJob } from "@mcma/core";
import { ResourceManager } from "@mcma/client";
import { AwsS3FileLocator } from "@mcma/aws-s3";

import { DescriptiveMetadata } from "@local/common";

import { ConfigService } from "./config.service";
import { McmaClientService } from "./mcma-client.service";
import { isFinished } from "../models/job-statuses";
import { WorkflowJobViewModel } from "../view-models/workflow-job-vm";

@Injectable()
export class WorkflowService {

    readonly WORKFLOW_NAME = "ConformWorkflow";
    readonly WORKFLOW_JOB_TYPE = "WorkflowJob";

    constructor(private configService: ConfigService, private mcmaClientService: McmaClientService) {
    }

    runWorkflow(objectKey: string, metadata: DescriptiveMetadata, profileName = this.WORKFLOW_NAME): Observable<WorkflowJob> {
        const workflowJobSubject = new BehaviorSubject<WorkflowJob>(null);

        const sub = this.mcmaClientService.resourceManager$.pipe(
            zip(this.configService.get<string>("aws.s3.uploadBucket")),
            switchMap(([resourceManager, uploadBucket]) => from(this.runWorkflowAsync(resourceManager, profileName, uploadBucket, objectKey, metadata)))
        ).subscribe(job => {
            sub.unsubscribe();
            workflowJobSubject.next(job);
        });

        return workflowJobSubject.asObservable();
    }

    getWorkflowJobs(): Observable<WorkflowJob[]> {
        const workflowJobsSubject = new Subject<WorkflowJob[]>();

        const sub = this.mcmaClientService.resourceManager$.pipe(
            switchMap(resourceManager => from(this.getWorkflowJobsAsync(resourceManager)))
        ).subscribe(jobs => {
            sub.unsubscribe();
            workflowJobsSubject.next(jobs);
        });

        return workflowJobsSubject.asObservable();
    }

    private getWorkflowJob(jobId: string): Observable<any> {
        return this.mcmaClientService.resourceManager$.pipe(switchMap(resourceManager => from(resourceManager.get<WorkflowJob>(jobId))));
    }

    getWorkflowJobVm(jobId: string): Observable<WorkflowJobViewModel> {
        return this.getWorkflowJob(jobId).pipe(map(workflowJob => new WorkflowJobViewModel(workflowJob)));
    }

    pollForCompletion(workflowJobId: string, fakeRunning = false): Observable<WorkflowJobViewModel> {
        const subject = new BehaviorSubject<WorkflowJobViewModel>(null);

        // poll until completion, emitting every 3 secs until the job is completed
        // when the job completes, unsubscribe from polling and load it one more time
        const sub1 =
            timer(0, 3000).pipe(
                switchMap(() => this.mcmaClientService.resourceManager$),
                switchMap(resourceManager => from(resourceManager.get<WorkflowJob>(workflowJobId))),
                takeWhile(j => !isFinished(j))
            ).subscribe(
                job => subject.next(new WorkflowJobViewModel(job, fakeRunning)),
                err => subject.error(err),
                () => {
                    // unsubscribe from polling
                    sub1.unsubscribe();
                    // get finished job data
                    const sub2 = this.getWorkflowJob(workflowJobId).subscribe(
                        workflowJob => subject.next(new WorkflowJobViewModel(workflowJob, fakeRunning)),
                        err => subject.error(err),
                        () => sub2.unsubscribe());
                }
            );

        return subject.asObservable();
    }

    private async getJobProfileIdAsync(resourceManager: ResourceManager, profileName: string) {
        // get job profiles filtered by name
        const jobProfiles = await resourceManager.query<JobProfile>("JobProfile", { name: profileName });

        const jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new Error(`JobProfile '${profileName}' not found`);
        }

        return jobProfileId;
    }

    private async runWorkflowAsync(resourceManager: ResourceManager,
                                   profileName: string,
                                   uploadBucket: string,
                                   objectKey: string,
                                   metadata: DescriptiveMetadata): Promise<WorkflowJob> {
        const jobProfileId = await this.getJobProfileIdAsync(resourceManager, profileName);

        // creating workflow job
        let workflowJob = new WorkflowJob({
            jobProfileId,
            jobInput: new JobParameterBag({
                metadata: metadata,
                inputFile: new AwsS3FileLocator({
                    bucket: uploadBucket,
                    key: objectKey
                })
            }),
            tracker: new McmaTracker({
                id: uuidv4(),
                label: "Workflow '" + metadata.name + "' with file '" + objectKey + "'",
                custom: {
                    "ingestName": metadata.name,
                    "ingestDescription": metadata.description,
                    "fileName": objectKey
                }
            })
        });

        // posting the workflowJob to the job repository
        workflowJob = await resourceManager.create(workflowJob);

        console.log(JSON.stringify(workflowJob, null, 2));

        return workflowJob;
    }

    private async getWorkflowJobsAsync(resourceManager: ResourceManager): Promise<WorkflowJob[]> {
        const jobProfileId = await this.getJobProfileIdAsync(resourceManager, this.WORKFLOW_NAME);

        const jobs = await resourceManager.query<WorkflowJob>("WorkflowJob");
        console.log("All jobs", jobs);

        const filteredJobs = jobs.filter(j => j["@type"] === this.WORKFLOW_JOB_TYPE && j.jobProfileId && j.jobProfileId === jobProfileId);
        console.log("Filtered jobs", filteredJobs);

        filteredJobs.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

        console.log("Sorted jobs'", filteredJobs);

        return filteredJobs;
    }
}
