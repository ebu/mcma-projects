import { v4 as uuidv4 } from "uuid";

import { CloudWatchEvents } from "aws-sdk";
import { Context, ScheduledEvent } from "aws-lambda";

import { Job, JobStatus, McmaTracker, ProblemDetail } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";

import { DataController } from "@local/job-processor";

const { LogGroupName, TableName, PublicUrl, CloudwatchEventRule, DefaultJobTimeoutInMinutes, WorkerFunctionId } = process.env;

const cloudWatchEvents = new CloudWatchEvents();
const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-periodic-job-checker", LogGroupName);

const dataController = new DataController(TableName, PublicUrl);

export async function handler(event: ScheduledEvent, context: Context) {
    const tracker = new McmaTracker({
        id: uuidv4(),
        label: "Periodic Job Checker - " + new Date().toUTCString()
    });

    const logger = loggerProvider.get(context.awsRequestId, tracker);
    try {
        await cloudWatchEvents.disableRule({ Name: CloudwatchEventRule }).promise();

        const newJobs = await dataController.queryJobs(JobStatus.New);
        const queuedJobs = await dataController.queryJobs(JobStatus.Queued);
        const scheduledJobs = await dataController.queryJobs(JobStatus.Scheduled);
        const runningJobs = await dataController.queryJobs(JobStatus.Running);

        const jobs: Job[] = [].concat.apply([], [newJobs, queuedJobs, scheduledJobs, runningJobs]);

        logger.info(`Found ${jobs.length} active jobs`);

        let activeJobs = 0;
        let failedJobsCount = 0;
        const now = new Date();

        for (const job of jobs) {
            let deadlinePassed = false;
            let timeoutPassed = false;

            let defaultTimeout = Number.parseInt(DefaultJobTimeoutInMinutes);

            if (job.deadLine) {
                defaultTimeout = undefined;
                if (job.deadline < now) {
                    deadlinePassed = true;
                }
            }

            const timeout = job.timeout ?? defaultTimeout;
            if (timeout) {
                const [jobExecution] = await dataController.getExecutions(job.id);

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
            await cloudWatchEvents.enableRule({ Name: CloudwatchEventRule }).promise();
        }
    } catch (error) {
        logger.error(error?.toString());
        throw error;
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}

async function failJob(job: Job, error: ProblemDetail) {
    await invokeLambdaWorker(WorkerFunctionId, {
        operationName: "FailJob",
        input: {
            jobId: job.id,
            error: error,
        },
        contextVariables: process.env,
        tracker: job.tracker,
    });
}
