import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from } from 'rxjs';

import { ResourceManager, WorkflowJob, JobParameterBag, DescriptiveMetadata, Locator } from 'mcma-core';

import { ConfigService } from './config.service';
import { map, zip, tap, switchMap } from 'rxjs/operators';

@Injectable()
export class WorkflowService {

    private resourceManager$: Observable<ResourceManager>;

    constructor(private configService: ConfigService) {
        this.resourceManager$ = this.configService.get<string>('servicesUrl').pipe(map(servicesUrl => new ResourceManager(servicesUrl)));
    }

    runWorkflow(objectKey: string, profileName = 'ConformWorkflow'): Observable<WorkflowJob> {
        const workflowJobSubject = new BehaviorSubject<WorkflowJob>(null);
        
        const sub = this.resourceManager$.pipe(
            zip(this.configService.get<string>('aws.s3.uploadBucket')),
            switchMap(([resourceManager, uploadBucket]) => from(this.runWorkflowAsync(resourceManager, profileName, uploadBucket, objectKey)))
        ).subscribe(job => {
            sub.unsubscribe();
            workflowJobSubject.next(job);
        });

        return workflowJobSubject.asObservable();
    }

    async runWorkflowAsync(resourceManager: ResourceManager, profileName: string, uploadBucket: string, objectKey: string) {
        // get job profiles filtered by name
        let jobProfiles = await resourceManager.get('JobProfile', { name: profileName });

        let jobProfileId = jobProfiles.length ? jobProfiles[0].id : null;

        // if not found bail out
        if (!jobProfileId) {
            throw new Error(`JobProfile '${profileName}' not found`);
        }

        // creating workflow job
        let workflowJob = new WorkflowJob(
            jobProfileId,
            new JobParameterBag({
                metadata: new DescriptiveMetadata({
                    name: 'Test video',
                    description: 'Description of test video'
                }),
                inputFile: new Locator({
                    awsS3Bucket: uploadBucket,
                    awsS3Key: objectKey
                })
            })
        );

        // posting the workflowJob to the job repository
        //workflowJob = await resourceManager.create(workflowJob);

        console.log(JSON.stringify(workflowJob, null, 2));

        return workflowJob;
    }
}