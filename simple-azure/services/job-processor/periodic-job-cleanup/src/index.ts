import { v4 as uuidv4 } from "uuid";
import { AzureFunction, Context } from "@azure/functions";

import { Job, JobStatus, McmaTracker } from "@mcma/core";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { invokeQueueTriggeredWorker } from "@mcma/azure-queue-worker-invoker";

import { DataController } from "@local/job-processor";

const { TableName, PublicUrl, JobRetentionPeriodInDays, WorkerFunctionId } = process.env;

const loggerProvider = new AppInsightsLoggerProvider("job-processor-periodic-job-cleanup");
const dataController = new DataController(TableName, PublicUrl);

export const handler: AzureFunction = async (context: Context) => {
    const tracker = new McmaTracker({
        id: uuidv4(),
        label: "Periodic Job Cleanup - " + new Date().toUTCString()
    });

    const logger = loggerProvider.get(context.invocationId, tracker);
    try {
        logger.info(`Job Retention Period set to ${JobRetentionPeriodInDays} days`);

        if (Number.parseInt(JobRetentionPeriodInDays) <= 0) {
            logger.info("Exiting");
            return;
        }

        const retentionDateLimit = new Date(Date.now() - Number.parseInt(JobRetentionPeriodInDays) * 24 * 3600 * 1000);

        const completedJobs = await dataController.queryJobs({ status: JobStatus.Completed, to: retentionDateLimit });
        const failedJobs = await dataController.queryJobs({ status: JobStatus.Failed, to: retentionDateLimit });
        const canceledJobs = await dataController.queryJobs({ status: JobStatus.Canceled, to: retentionDateLimit });


        const jobs =
            completedJobs.results
                .concat(failedJobs.results)
                .concat(canceledJobs.results);

        logger.info(`Deleting ${jobs.length} jobs older than ${retentionDateLimit.toISOString()}`);

        for (const job of jobs) {
            await deleteJob(job);
        }
    } catch (error) {
        logger.error(error?.toString());
        throw error;
    } finally {
        logger.functionEnd(context.invocationId);
    }
}

async function deleteJob(job: Job) {
    await invokeQueueTriggeredWorker(WorkerFunctionId, {
        operationName: "DeleteJob",
        input: {
            jobId: job.id,
        },
        contextVariables: process.env,
        tracker: job.tracker,
    });
}
