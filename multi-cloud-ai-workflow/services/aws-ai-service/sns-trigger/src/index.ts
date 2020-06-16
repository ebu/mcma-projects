import * as AWS from "aws-sdk";
import { Context, SNSEvent } from "aws-lambda";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { EnvironmentVariableProvider, getTableName, JobAssignment, McmaException } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";

const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });

const dbTableProvider = new DynamoDbTableProvider();
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("aws-ai-service-sns-trigger", process.env.LogGroupName);

export async function handler(event: SNSEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        for (const record of event.Records) {
            try {

                // check if the payload contains data from SNS
                if (!record.Sns) {
                    throw new McmaException("The payload doesn't contain expected data : Sns");
                }

                if (!record.Sns.Message) {
                    throw new McmaException("The payload doesn't contain expected data : Sns.Message");
                }

                let message = JSON.parse(record.Sns.Message);
                logger.debug("SNS Message == > ");
                logger.debug(message);

                let rekoJobId = message.JobId;
                let rekoJobType = message.API;
                let status = message.Status;

                let jt = message.JobTag.toString();
                logger.debug("jt:", jt);

                const jobAssignmentId = Buffer.from(jt, "hex").toString("ascii");

                logger.debug("rekoJobId:", rekoJobId);
                logger.debug("rekoJobType:", rekoJobType);
                logger.debug("status:", status);
                logger.debug("jobAssignmentId:", jobAssignmentId);

                const table = dbTableProvider.get<JobAssignment>(getTableName(environmentVariableProvider), JobAssignment);
                const jobAssignment = await table.get(jobAssignmentId);
                if (!jobAssignment) {
                    throw new McmaException("Failed to find JobAssignment with id: " + jobAssignmentId);
                }

                // invoking worker lambda function that will process the results of transcription job
                const params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable<string>("WorkerFunctionId"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessRekognitionResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            jobInfo: {
                                rekoJobId,
                                rekoJobType,
                                status
                            }
                        },
                        tracker: jobAssignment.tracker
                    })
                };

                await Lambda.invoke(params).promise();
            } catch (error) {
                logger.error("Failed processing record", record);
                logger.error(error.toString());
            }
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
