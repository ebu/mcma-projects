import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { Notification } from "@mcma/core";

import { MediaWorkflowProperties } from "@local/model";
import { DataController } from "@local/data";

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest, context: { requestId: string, dataController: DataController }) {
    const logger = workerRequest.logger;
    const dataController = context.dataController;

    const mediaWorkflowDatabaseId = workerRequest.input.mediaWorkflowDatabaseId;
    const notification: Notification = workerRequest.input.notification;
    const workflowJob = notification.content;

    const mediaWorkflow = await dataController.get<MediaWorkflowProperties>(mediaWorkflowDatabaseId);

    mediaWorkflow.status = workflowJob.status;
    mediaWorkflow.error = workflowJob.error;

    dataController.put(mediaWorkflow.id, mediaWorkflow);
    logger.info(`Updated media workflow ${mediaWorkflowDatabaseId}`);
    logger.info(mediaWorkflow);
}
