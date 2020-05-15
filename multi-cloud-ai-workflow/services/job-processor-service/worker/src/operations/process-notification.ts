import { getTableName, JobProcess, JobStatus } from "@mcma/core";
import { ProviderCollection, WorkerRequest } from "@mcma/worker";
import { DynamoDbMutex } from "@mcma/aws-dynamodb";

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest, context: any) {
    const jobProcessId = workerRequest.input.jobProcessId;
    const notification = workerRequest.input.notification;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    const tableName = getTableName(workerRequest);
    const table = providers.dbTableProvider.get(tableName, JobProcess);
    const mutex = new DynamoDbMutex(jobProcessId, context.awsRequestId, tableName, logger);

    let jobProcess: JobProcess;

    await mutex.lock();
    try {
        jobProcess = new JobProcess(await table.get(jobProcessId));

        // not updating jobProcess if it already was marked as completed or failed.
        if (jobProcess.status === JobStatus.Completed || jobProcess.status === JobStatus.Failed || jobProcess.status === JobStatus.Canceled ||
            (jobProcess.status === JobStatus.Running && notification.content.status === JobStatus.Scheduled)) {
            logger.warn("Ignoring notification for job process that would change state from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);
            return;
        }

        if (jobProcess.status !== notification.content.status) {
            logger.info("JobProcess changed status from " + jobProcess.status + " to " + notification.content.status + ": " + jobProcess.id);

            switch (notification.content.status) {
                case JobStatus.Scheduled:
                case JobStatus.Running:
                    if (!jobProcess.actualStartDate) {
                        jobProcess.actualStartDate = new Date();
                    }
                    break;
                case JobStatus.Failed:
                case JobStatus.Canceled:
                case JobStatus.Completed:
                    if (!jobProcess.actualEndDate) {
                        jobProcess.actualEndDate = new Date();
                    }

                    jobProcess.actualDuration = 0;

                    if (jobProcess.actualStartDate && jobProcess.actualEndDate) {
                        let startDate = jobProcess.actualStartDate.getTime();
                        let endDate = jobProcess.actualEndDate.getTime();
                        if (Number.isInteger(startDate) && Number.isInteger(endDate) && startDate < endDate) {
                            jobProcess.actualDuration = endDate - startDate;
                        }
                    }
                    break;
            }
        }

        if (jobProcess.statusMessage !== notification.content.statusMessage) {
            logger.info("JobProcess has statusMessage '" + notification.content.statusMessage + "': " + jobProcess.id);
        }

        jobProcess.status = notification.content.status;
        jobProcess.statusMessage = notification.content.statusMessage;
        jobProcess.progress = notification.content.progress;
        jobProcess.jobOutput = notification.content.jobOutput;
        jobProcess.dateModified = new Date();

        jobProcess = await table.put(jobProcessId, jobProcess);
    } finally {
        await mutex.unlock();
    }

    await resourceManager.sendNotification(jobProcess);
}
