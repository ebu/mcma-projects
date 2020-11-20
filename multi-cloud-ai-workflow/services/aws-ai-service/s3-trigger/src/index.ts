import { Context, S3Event } from "aws-lambda";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { McmaException } from "@mcma/core";
import { getTableName } from "@mcma/data";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";
import { getWorkerFunctionId } from "@mcma/worker-invoker";

const dbTableProvider = new DynamoDbTableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("aws-ai-service-s3-trigger", process.env.LogGroupName);
const workerInvoker = new LambdaWorkerInvoker();

export async function handler(event: S3Event, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        for (const record of event.Records) {
            try {
                let bucket = record.s3.bucket.name;
                let key = record.s3.object.key;

                let jobAssignmentGuid: string;
                let operationName: string;

                //  EXTRACT UUID FROM FILENAME AS FOLLOWS !!!!!!!!!!!!!!!
                // "TextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 16
                //                  16                                  52
                // "001-TokenizedTextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 25
                //                               29                                  65

                if (new RegExp(/^TextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(key)) {
                    jobAssignmentGuid = key.substring(16, 52);
                    operationName = "ProcessTextToSpeechJobResult";
                } else if (new RegExp(/^ssmlTextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(key)) {
                    jobAssignmentGuid = key.substring(20, 56);
                    operationName = "ProcessSsmlTextToSpeechJobResult";
                } else if (new RegExp(/^[0-9]{3}-TextTokensSpeechMarksJob-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\..*\.marks$/i).test(key)) {
                    jobAssignmentGuid = key.substring(29, 65);
                    operationName = "ProcessTokenizedTextToSpeechJobResult";
                } else if (new RegExp(/^TranscriptionJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i).test(key)) {
                    jobAssignmentGuid = key.substring(key.indexOf("-") + 1, key.lastIndexOf("."));
                    operationName = "ProcessTranscribeJobResult";
                } else {
                    throw new McmaException("S3 key '" + key + "' is not an expected file name processing in this lambda function");
                }

                const jobAssignmentDatabaseId = "/job-assignments/" + jobAssignmentGuid;

                const table = await dbTableProvider.get(getTableName());
                const jobAssignment = await table.get(jobAssignmentDatabaseId);
                if (!jobAssignment) {
                    throw new McmaException("Failed to find JobAssignment with id: " + jobAssignmentDatabaseId);
                }

                await workerInvoker.invoke(
                    getWorkerFunctionId(),
                    {
                        operationName,
                        input: {
                            jobAssignmentDatabaseId,
                            outputFile: new AwsS3FileLocator({ bucket: bucket, key: key })
                        },
                        tracker: jobAssignment.tracker
                    });
            } catch (error) {
                logger.error("Failed processing record", record, error);
            }
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
