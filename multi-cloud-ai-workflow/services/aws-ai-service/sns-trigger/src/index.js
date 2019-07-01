//"use strict";

const util = require("util");

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const { Logger, EnvironmentVariableProvider } = require("mcma-core");

const environmentVariableProvider = new EnvironmentVariableProvider();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    if (!event || !event.Records) {
        return;
    }

    for (const record of event.Records) {
        try {
            //let awsS3Bucket = record.s3.bucket.name;
            //let awsS3Key = record.s3.object.key;

            // check if the payload contains data from SNS
            if (!record.Sns) {
                throw new Error("The payload doesn't contain expected data : Sns");
            }

            if (!record.Sns.Message) {
                throw new Error("The payload doesn't contain expected data : Sns.Message");
            }

            let message = JSON.parse(record.Sns.Message);
            Logger.debug("SNS Message == > ", JSON.stringify(message));

            let rekoJobId = message.JobId;
            let rekoJobType = message.API;
            let status = message.Status;
            let jobAssignmentId;

            let jt = message.JobTag.toString();
            Logger.debug("jt:", jt);

            if (jt != null) {
                jobAssignmentId = new Buffer(jt, "hex").toString("ascii");
            } else {
                return callback("The jobAssignment couldn't be found in the SNS message");
            }

            Logger.debug("rekoJobId:", rekoJobId);
            Logger.debug("rekoJobType:", rekoJobType);
            Logger.debug("status:", status);
            Logger.debug("jobAssignmentId:", jobAssignmentId);

            // invoking worker lambda function that will process the results of transcription job
            const params = {
                FunctionName: environmentVariableProvider.getRequiredContextVariable("WorkerFunctionName"),
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
                    }
                })
            };

            await LambdaInvoke(params);
        } catch (error) {
            Logger.error("Failed processing record", record, error);
        }
    }

}
