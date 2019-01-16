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
            console.log("SNS Message == > ", JSON.stringify(message));


            let rekoJobId = message.JobId;
            let rekoJobType = message.API;
            let status = message.Status;
            let jobAssignmentId;
            let jobAssignment;

            let jt = message.JobTag.toString();
            console.log("jt:", jt);

            if (jt != null) {
                jobAssignmentId = new Buffer(jt, 'hex').toString('ascii');
            } else {
                return callback("The jobAssignment couldn't be found in the SNS message");
            }

            console.log('rekoJobId:', rekoJobId);
            console.log('rekoJobType:', rekoJobType);
            console.log('status:', status);
            console.log('jobAssignmentId:', jobAssignmentId);



            //  let transcribeJobUUID = awsS3Key.substring(awsS3Key.indexOf("-") + 1, awsS3Key.lastIndexOf("."));

            //let jobAssignmentId = STAGE_VARIABLES.PublicUrl + "/job-assignments/" + transcribeJobUUID;

            // invoking worker lambda function that will process the results of transcription job
            var params = {
                FunctionName: STAGE_VARIABLES.WorkerLambdaFunctionName,
                InvocationType: "Event",
                LogType: "None",
                Payload: JSON.stringify({
                    action: "ProcessRekognitionResult",
                    stageVariables: STAGE_VARIABLES,
                    jobAssignmentId,
                    jobExternalInfo: {
                        rekoJobId,
                        rekoJobType,
                        status
                    }
                })
            };

            await LambdaInvoke(params);
        } catch (error) {
            console.log("Failed processing record", record, error);
        }
    }

}
