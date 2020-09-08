import { v4 as uuidv4 } from "uuid";
import { Context, ScheduledEvent } from "aws-lambda";

import { Job, JobStatus, McmaTracker } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";

import { DataController } from "@local/job-processor";

const { LogGroupName, TableName, PublicUrl, JobRetentionPeriodInDays, WorkerFunctionId } = process.env;

const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-periodic-job-cleanup", LogGroupName);
const dataController = new DataController(TableName, PublicUrl);

export async function handler(event: ScheduledEvent, context: Context) {
    const tracker = new McmaTracker({
        id: uuidv4(),
        label: "Periodic Job Cleanup - " + new Date().toUTCString()
    });

    const logger = loggerProvider.get(context.awsRequestId, tracker);
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
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}

async function deleteJob(job: Job) {
    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "DeleteJob",
        input: {
            jobId: job.id,
        },
        contextVariables: process.env,
        tracker: job.tracker,
    });
}
