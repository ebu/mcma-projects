//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_CORE = require("mcma-core");

const STAGE_VARIABLES = {
    TableName: process.env.TableName,
    PublicUrl: process.env.PublicUrl,
    ServicesUrl: process.env.ServicesUrl,
    ServicesAuthType: process.env.ServicesAuthType,
    ServicesAuthContext: process.env.ServicesAuthContext,
    WorkerLambdaFunctionName: process.env.WorkerLambdaFunctionName,
    ServiceOutputBucket: process.env.ServiceOutputBucket
}

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    if (!event || !event.Records) {
        return;
    }

    for (const record of event.Records) {
        try {
            let awsS3Bucket = record.s3.bucket.name;
            let awsS3Key = record.s3.object.key;

            if (!new RegExp(/^TranscriptionJob-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i).test(awsS3Key)) {
                throw new Error("S3 key '" + awsS3Key + "' is not an expected file name for transcribe output")
            }

            let transcribeJobUUID = awsS3Key.substring(awsS3Key.indexOf("-") + 1, awsS3Key.lastIndexOf("."));

            let jobAssignmentId = STAGE_VARIABLES.PublicUrl + "/job-assignments/" + transcribeJobUUID;

            // invoking worker lambda function that will process the results of transcription job
            var params = {
                FunctionName: STAGE_VARIABLES.WorkerLambdaFunctionName,
                InvocationType: "Event",
                LogType: "None",
                Payload: JSON.stringify({
                    "action": "ProcessTranscribeJobResult",
                    "stageVariables": STAGE_VARIABLES,
                    "jobAssignmentId": jobAssignmentId,
                    "outputFile": new MCMA_CORE.Locator({ awsS3Bucket: awsS3Bucket, awsS3Key: awsS3Key })
                })
            };

            await LambdaInvoke(params);
        } catch (error) {
            console.log("Failed processing record", record, error);
        }
    }

}
