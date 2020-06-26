import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, JobBaseProperties, JobProperties, JobStatus } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { ProblemDetail } from "@mcma/core/dist/lib/model/problem-detail";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("process-workflow-failure", process.env.LogGroupName);

type InputEvent = {
    error: {
        Cause?: string;
    };
} & JobBaseProperties;

export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);

    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        let error = new ProblemDetail({
            type: "uri://mcma.ebu.ch/rfc7807/workflow-service/generic-workflow-failure",
            title: "Workflow failure",
            detail: "Unknown reason"
        });

        switch (event.error?.Error) {
            case "Error": {
                let detail;

                try {
                    detail = JSON.parse(event.error?.Cause).errorMessage ?? event.error?.Cause ?? "Unknown error occurred"
                } catch (e) {
                    detail = event.error?.Cause ?? "Unknown error occurred"
                }

                error = new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/workflow-service/step-failure",
                    title: "Error in execution of workflow step",
                    detail
                });
                break;
            }
            case "JobFailed": {
                const job: JobProperties = JSON.parse(event.error?.Cause);

                error = new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/workflow-service/job-failure",
                    title: "Execution of Job Failed",
                    detail: `Job '${job.id} failed due to error '${job.error.title}`,
                    job: job,
                });
                break;
            }
            case "JobCanceled": {
                const job: JobProperties = JSON.parse(event.error?.Cause);

                error = new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/workflow-service/job-failure",
                    title: "Execution of Job Canceled",
                    detail: `Job '${job.id} failed due to error '${job.error.title}`,
                    job
                });
                event.statusMessage = event.error?.Cause ?? "Execution of Job Canceled";
                break;
            }
            case "States.Timeout": {
                error = new ProblemDetail({
                    type: "uri://mcma.ebu.ch/rfc7807/workflow-service/job-execution-timeout",
                    title: "Execution of Job Timed out"
                });
                break;
            }
        }

        event.status = JobStatus.Failed;
        event.error = error;

        try {
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.error("Failed to send notification");
            logger.error(error.toString());
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
