import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { Job, JobStatus, McmaTracker } from "@mcma/core";
import { CloudLoggingLoggerProvider } from "@mcma/google-cloud-logger";
import { invokePubSubTriggeredWorker } from "@mcma/google-cloud-pubsub-worker-invoker";

import { DataController } from "@local/job-processor";

const { TableName, PublicUrl, JobRetentionPeriodInDays, WorkerFunctionId } = process.env;

const loggerProvider = new CloudLoggingLoggerProvider("job-processor-periodic-job-cleanup");
const dataController = new DataController(TableName, PublicUrl);

export async function handler(req: Request, res: Response) {
    const executionId = req.get("function-execution-id");
    const tracker = new McmaTracker({
        id: uuidv4(),
        label: "Periodic Job Cleanup - " + new Date().toUTCString()
    });

    const logger = loggerProvider.get(executionId, tracker);
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

        res.status(200);
        res.end();
    } catch (error) {
        res.status(500);
        logger.error(error?.toString());
        throw error;
    } finally {
        logger.functionEnd(executionId);
    }
}

async function deleteJob(job: Job) {
    await invokePubSubTriggeredWorker(WorkerFunctionId, {
        operationName: "DeleteJob",
        input: {
            jobId: job.id,
        },
        tracker: job.tracker,
    });
}
