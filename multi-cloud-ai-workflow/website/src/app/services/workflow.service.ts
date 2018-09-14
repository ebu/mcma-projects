import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, from, timer, of } from 'rxjs';
import { map, zip, switchMap, concatMap, takeWhile } from 'rxjs/operators';

import { ResourceManager, WorkflowJob, JobParameterBag, DescriptiveMetadata, Locator, HTTP } from 'mcma-core';

import { ConfigService } from './config.service';
import { JobStatus } from '../models/job-statuses';
import { WorkflowJobViewModel } from '../view-models/workflow-job-vm';

@Injectable()
export class WorkflowService {

    readonly WORKFLOW_NAME = 'ConformWorkflow';
    readonly WORKFLOW_JOB_TYPE = 'WorkflowJob';

    private resourceManager$: Observable<ResourceManager>;

    constructor(private configService: ConfigService) {
        this.resourceManager$ = this.configService.get<string>('servicesUrl').pipe(map(servicesUrl => new ResourceManager(servicesUrl)));
    }

    runWorkflow(objectKey: string, metadata: DescriptiveMetadata, profileName = this.WORKFLOW_NAME): Observable<WorkflowJob> {
        const workflowJobSubject = new BehaviorSubject<WorkflowJob>(null);
        
        const sub = this.resourceManager$.pipe(
            zip(this.configService.get<string>('aws.s3.uploadBucket')),
            switchMap(([resourceManager, uploadBucket]) => from(this.runWorkflowAsync(resourceManager, profileName, uploadBucket, objectKey, metadata)))
        ).subscribe(job => {
            sub.unsubscribe();
            workflowJobSubject.next(job);
        });

        return workflowJobSubject.asObservable();
    }

    getWorkflowJobs(): Observable<WorkflowJob[]> {
        const workflowJobsSubject = new Subject<WorkflowJob[]>();
        
        const sub = this.resourceManager$.pipe(
            switchMap(resourceManager => from(this.getWorkflowJobsAsync(resourceManager)))
        ).subscribe(jobs => {
            sub.unsubscribe();
            workflowJobsSubject.next(jobs);
        });

        return workflowJobsSubject.asObservable();
    }

    getWorkflowJob(jobId: string): Observable<WorkflowJobViewModel> {
        return from<WorkflowJob>(HTTP.get(jobId)).pipe(map(resp => new WorkflowJobViewModel(resp.data)));
    }

    pollForCompletion(workflowJobId: string, fakeRunning = false): Observable<WorkflowJobViewModel> {
        const subject = new BehaviorSubject<WorkflowJobViewModel>(null);
        
        // poll until completion, emitting every 3 secs until the job is completed
        // when the job completes, unsubscribe from polling and load it one more time
        const sub1 =
            timer(0, 3000).pipe(
                concatMap(() => from<WorkflowJob>(HTTP.get(workflowJobId))),
                map(resp => resp.data),
                takeWhile(j => !JobStatus.isFinished(j))
            ).subscribe(
                job => subject.next(new WorkflowJobViewModel(job, fakeRunning)),
                err => subject.error(err),
                () => {
                    // unsubscribe from polling
                    sub1.unsubscribe();
                    // get finished job data
                    const sub2 = from<WorkflowJob>(HTTP.get(workflowJobId)).subscribe(
                        resp => subject.next(new WorkflowJobViewModel(resp.data, fakeRunning)),
                        err => subject.error(err),
                        () => sub2.unsubscribe());
                }
            );

        return subject.asObservable();
    }

    private async getJobProfileIdAsync(resourceManager: ResourceManager, profileName: string) {
        // get job profiles filtered by name
        const jobProfiles = await resourceManager.get('JobProfile', { name: profileName });

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
        let workflowJob = new WorkflowJob(
            jobProfileId,
            new JobParameterBag({
                metadata: metadata,
                inputFile: new Locator({
                    awsS3Bucket: uploadBucket,
                    awsS3Key: objectKey
                })
            })
        );

        // posting the workflowJob to the job repository
        workflowJob = await resourceManager.create(workflowJob);

        console.log(JSON.stringify(workflowJob, null, 2));

        return workflowJob;
    }

    private async getWorkflowJobsAsync(resourceManager: ResourceManager): Promise<WorkflowJob[]> {
        const jobProfileId = await this.getJobProfileIdAsync(resourceManager, this.WORKFLOW_NAME);

        const jobs: WorkflowJob[] = await resourceManager.get(this.WORKFLOW_JOB_TYPE);
        console.log('All jobs', jobs);
        
        const filteredJobs = jobs.filter(j => j['@type'] === this.WORKFLOW_JOB_TYPE && j.jobProfile && j.jobProfile === jobProfileId);
        console.log('Filtered jobs', filteredJobs);

        filteredJobs.sort((a, b) => new Date(b.dateCreated).getTime() -  new Date(a.dateCreated).getTime());

        console.log("Sorted jobs'", filteredJobs);

        return filteredJobs;
    }
}