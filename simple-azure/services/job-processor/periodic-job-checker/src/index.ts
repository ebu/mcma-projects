import { v4 as uuidv4 } from "uuid";

import { AzureFunction, Context } from "@azure/functions";

import { EnvironmentVariableProvider, Job, JobStatus, McmaTracker, ProblemDetail } from "@mcma/core";
import { AppInsightsLoggerProvider } from "@mcma/azure-logger";
import { invokeQueueTriggeredWorker } from "@mcma/azure-queue-worker-invoker";

import { DataController, PeriodicJobCheckerCronJob } from "@local/job-processor";

const { TableName, PublicUrl, DefaultJobTimeoutInMinutes, WorkerFunctionId } = process.env;

const loggerProvider = new AppInsightsLoggerProvider("job-processor-periodic-job-checker");

const dataController = new DataController(TableName, PublicUrl);
const periodicJobCheckerCronJob = new PeriodicJobCheckerCronJob(new EnvironmentVariableProvider());

export const handler: AzureFunction = async (context: Context) => {
    const tracker = new McmaTracker({
        id: uuidv4(),
        label: "Periodic Job Checker - " + new Date().toUTCString()
    });

    const logger = loggerProvider.get(context.invocationId, tracker);
    try {
        logger.functionStart(context.invocationId);
        
        await periodicJobCheckerCronJob.disable();

        const newJobs = await dataController.queryJobs({ status: JobStatus.New });
        const queuedJobs = await dataController.queryJobs({ status: JobStatus.Queued });
        const scheduledJobs = await dataController.queryJobs({ status: JobStatus.Scheduled });
        const runningJobs = await dataController.queryJobs({ status: JobStatus.Running });

        const jobs =
            newJobs.results
                .concat(queuedJobs.results)
                .concat(scheduledJobs.results)
                .concat(runningJobs.results);

        logger.info(`Found ${jobs.length} active jobs`);

        let activeJobs = 0;
        let failedJobsCount = 0;
        const now = new Date();

        for (const job of jobs) {
            let deadlinePassed = false;
            let timeoutPassed = false;

            let defaultTimeout = Number.parseInt(DefaultJobTimeoutInMinutes);

            if (job.deadline) {
                defaultTimeout = undefined;
                if (job.deadline < now) {
                    deadlinePassed = true;
                }
            }

            const timeout = job.timeout ?? defaultTimeout;
            if (timeout) {
                const [jobExecution] = (await dataController.getExecutions(job.id)).results;

                const startDate = jobExecution?.actualStartDate ?? jobExecution?.dateCreated ?? job.dateCreated;

                const timePassedInMinutes = (now.getTime() - startDate.getTime()) / 60000;

                if (timePassedInMinutes > timeout) {
                    timeoutPassed = true;
                }
            }

            if (deadlinePassed) {
                await failJob(job, new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/job-processor/job-deadline-passed",
                    title: "Job failed to complete before deadline",
                    detail: `Job missed deadline of ${job.deadline.toISOString()}`,
                }));
                failedJobsCount++;
            } else if (timeoutPassed) {
                await failJob(job, new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/job-processor/job-timeout-passed",
                    title: "Job failed to complete before timeout limit",
                    detail: `Job timed out after ${timeout} minutes`,
                }));
                failedJobsCount++;
            } else {
                activeJobs++;
            }
        }

        logger.info(`Failed ${failedJobsCount} due to deadline or timeout constraints`);

        if (activeJobs) {
            logger.info(`There are ${activeJobs} active jobs remaining`);
            await periodicJobCheckerCronJob.enable();
        }
    } catch (error) {
        logger.error(error?.toString());
        throw error;
    } finally {
        logger.functionEnd(context.invocationId);
    }
}

async function failJob(job: Job, error: ProblemDetail) {
    await invokeQueueTriggeredWorker(WorkerFunctionId, {
        operationName: "FailJob",
        input: {
            jobId: job.id,
            error: error,
        },
        contextVariables: process.env,
        tracker: job.tracker,
    });
}
