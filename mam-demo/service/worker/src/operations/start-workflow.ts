import { v4 as uuidv4 } from "uuid";

import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { JobParameterBag, McmaTracker, NotificationEndpoint, WorkflowJob } from "@mcma/core";
import { MediaWorkflowProperties } from "@local/model";
import { DataController } from "@local/data";

import { getJobProfileId } from "./utils";

export async function startWorkflow(providers: ProviderCollection, workerRequest: WorkerRequest, context: { requestId: string, dataController: DataController }) {
    const logger = workerRequest.logger;
    const dataController = context.dataController;
    const resourceManager = providers.resourceManagerProvider.get();

    const mediaWorkflow: MediaWorkflowProperties = workerRequest.input.mediaWorkflow;

    const label = `${mediaWorkflow.type} of ${mediaWorkflow.input.title}`;

    logger.info(`Creating ${label}`);

    let job = new WorkflowJob({
        parentId: mediaWorkflow.id,
        jobProfileId: await getJobProfileId(resourceManager, mediaWorkflow.type + "Workflow"),
        jobInput: new JobParameterBag(Object.assign({ mediaWorkflowId: mediaWorkflow.id }, mediaWorkflow.input)),
        tracker: new McmaTracker({
            id: uuidv4(),
            label
        }),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: mediaWorkflow.id + "/notifications"
        })
    });

    job = await resourceManager.create(job);

    mediaWorkflow.workflowJobId = job.id;

    await dataController.put(mediaWorkflow.id, mediaWorkflow);
}
