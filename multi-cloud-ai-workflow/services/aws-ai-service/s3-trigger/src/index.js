//"use strict";

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });

const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
const { Exception, EnvironmentVariableProvider, JobAssignment } = require("@mcma/core");
const { AwsCloudWatchLoggerProvider } = require("@mcma/aws-logger");
const { AwsS3FileLocator } = require("@mcma/aws-s3");

const dbTableProvider = new DynamoDbTableProvider(JobAssignment);
const environmentVariableProvider = new EnvironmentVariableProvider();
const loggerProvider = new AwsCloudWatchLoggerProvider("aws-ai-service-s3-trigger", process.env.LogGroupName);

exports.handler = async (event, context) => {
    const logger = loggerProvider.get();
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        for (const record of event.Records) {
            try {
                let awsS3Bucket = record.s3.bucket.name;
                let awsS3Key = record.s3.object.key;

                let jobAssignmentGuid;
                let operationName;

                //  EXTRACT UUID FROM FILENAME AS FOLLOWS !!!!!!!!!!!!!!!
                // "TextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 16
                //                  16                                  52
                // "001-TokenizedTextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 25
                //                               29                                  65

                if (new RegExp(/^TextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(awsS3Key)) {
                    jobAssignmentGuid = awsS3Key.substring(16, 52);
                    operationName = "ProcessTextToSpeechJobResult";
                } else if (new RegExp(/^ssmlTextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(awsS3Key)) {
                    jobAssignmentGuid = awsS3Key.substring(20, 56);
                    operationName = "ProcessSsmlTextToSpeechJobResult";
                } else if (new RegExp(/^[0-9]{3}-TextTokensSpeechMarksJob-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\..*\.marks$/i).test(awsS3Key)) {
                    jobAssignmentGuid = awsS3Key.substring(29, 65);
                    operationName = "ProcessTokenizedTextToSpeechJobResult";
                } else if (new RegExp(/^TranscriptionJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i).test(awsS3Key)) {
                    jobAssignmentGuid = awsS3Key.substring(awsS3Key.indexOf("-") + 1, awsS3Key.lastIndexOf("."));
                    operationName = "ProcessTranscribeJobResult";
                } else {
                    throw new Exception("S3 key '" + awsS3Key + "' is not an expected file name processing in this lambda function");
                }

                const jobAssignmentId = environmentVariableProvider.getRequiredContextVariable("PublicUrl") + "/job-assignments/" + jobAssignmentGuid;

                const table = dbTableProvider.get(environmentVariableProvider.tableName());
                const jobAssignment = await table.get(jobAssignmentId);
                if (!jobAssignment) {
                    throw new Exception("Failed to find JobAssignment with id: " + jobAssignmentId);
                }

                const params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionId"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName,
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new AwsS3FileLocator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        },
                        tracker: jobAssignment.tracker
                    })
                };

                await Lambda.invoke(params).promise();
            } catch (error) {
                logger.error("Failed processing record", record, error);
            }
        }
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
};
