//"use strict";

const util = require("util");

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const { Logger, Locator, EnvironmentVariableProvider } = require("mcma-core");
require("mcma-api");

const environmentVariableProvider = new EnvironmentVariableProvider();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    if (!event || !event.Records) {
        return;
    }

    for (const record of event.Records) {
        try {
            let awsS3Bucket = record.s3.bucket.name;
            let awsS3Key = record.s3.object.key;

            let params;

            //  EXTRACT UUID FROM FILENAME AS FOLLOWS !!!!!!!!!!!!!!!
            // "TextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 16
            //                  16                                  52
            // "001-TokenizedTextToSpeechJob-c0cca2ea-4a23-45c1-bcf4-ab570638ed41.5a321518-b733-48b4-9c53-17a71894c56e.mp3" ->start at 25
            //                               29                                  65

            if (new RegExp(/^TextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(awsS3Key)) {
                const textToSpeechJobUUID = awsS3Key.substring(16, 52);

                const jobAssignmentId = environmentVariableProvider.publicUrl() + "/job-assignments/" + textToSpeechJobUUID;

                // invoking worker lambda function that will process the results of text to speech job
                params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessTextToSpeechJobResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        }
                    })
                };
            } 
/*            else if (new RegExp(/^[0-9]{3}-TokenizedTextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(awsS3Key)) {
                const tokenizedTextToSpeechJobUUID = awsS3Key.substring(29, 65);

                const jobAssignmentId = environmentVariableProvider.publicUrl() + "/job-assignments/" + tokenizedTextToSpeechJobUUID;

                // invoking worker lambda function that will process the results of transcription job
                params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessTokenizedTextToSpeechJobResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        }
                    })
                };
            }  
*/            else if (new RegExp(/^ssmlTextToSpeechJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\..*\.mp3$/i).test(awsS3Key)) {
                const ssmlTextToSpeechJobUUID = awsS3Key.substring(20, 56);

                const jobAssignmentId = environmentVariableProvider.publicUrl() + "/job-assignments/" + ssmlTextToSpeechJobUUID;

                // invoking worker lambda function that will process the results of the polly SSML text to speech job
                params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessSsmlTextToSpeechJobResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        }
                    })
                };
            } else if (new RegExp(/^[0-9]{3}-TextTokensSpeechMarksJob-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\..*\.marks$/i).test(awsS3Key)) {
                const tokenizedTextToSpeechJobUUID = awsS3Key.substring(29, 65);

                const jobAssignmentId = environmentVariableProvider.publicUrl() + "/job-assignments/" + tokenizedTextToSpeechJobUUID;

                // invoking worker lambda function that will process the results of Polly tokenized sentence speechmarks extraction job
                params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessTokenizedTextToSpeechJobResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        }
                    })
                };
            } else if (new RegExp(/^TranscriptionJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i).test(awsS3Key)) {
                const transcribeJobUUID = awsS3Key.substring(awsS3Key.indexOf("-") + 1, awsS3Key.lastIndexOf("."));

                const jobAssignmentId = environmentVariableProvider.publicUrl() + "/job-assignments/" + transcribeJobUUID;

                // invoking worker lambda function that will process the results of transcription job
                params = {
                    FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
                    InvocationType: "Event",
                    LogType: "None",
                    Payload: JSON.stringify({
                        operationName: "ProcessTranscribeJobResult",
                        contextVariables: environmentVariableProvider.getAllContextVariables(),
                        input: {
                            jobAssignmentId,
                            outputFile: new Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                        }
                    })
                };
            } else {
                throw new Error("S3 key '" + awsS3Key + "' is not an expected file name for transcribe output or textToSpeech output");
            }

            await LambdaInvoke(params);

        } catch (error) {
            Logger.error("Failed processing record", record, error);
        }
    }

}
