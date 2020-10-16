import { Context, SNSEvent } from "aws-lambda";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { EnvironmentVariableProvider, getTableName, McmaException } from "@mcma/core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { invokeLambdaWorker } from "@mcma/aws-lambda-worker-invoker";

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

                const jobAssignmentDatabaseId = Buffer.from(jt, "hex").toString("ascii");

                logger.debug("rekoJobId:", rekoJobId);
                logger.debug("rekoJobType:", rekoJobType);
                logger.debug("status:", status);
                logger.debug("jobAssignmentDatabaseId:", jobAssignmentDatabaseId);

                const table = await dbTableProvider.get(getTableName(environmentVariableProvider));
                const jobAssignment = await table.get(jobAssignmentDatabaseId);
                if (!jobAssignment) {
                    throw new McmaException("Failed to find JobAssignment with id: " + jobAssignmentDatabaseId);
                }

                // invoking worker lambda function that will process the results of transcription job
                await invokeLambdaWorker(environmentVariableProvider.getRequiredContextVariable<string>("WorkerFunctionId"),
                    {
                        operationName: "ProcessRekognitionResult",
                        input: {
                            jobAssignmentDatabaseId,
                            jobInfo: {
                                rekoJobId,
                                rekoJobType,
                                status
                            }
                        },
                        tracker: jobAssignment.tracker
                    });
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
