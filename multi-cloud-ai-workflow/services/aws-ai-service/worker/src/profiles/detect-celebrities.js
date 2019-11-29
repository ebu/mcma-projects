const util = require("util");
const crypto = require("crypto");

const AWS = require('aws-sdk');

const Rekognition = new AWS.Rekognition();
const RekognitionStartCelebrityRecognition = util.promisify(Rekognition.startCelebrityRecognition.bind(Rekognition));

const { Logger, EnvironmentVariableProvider } = require("mcma-core");

const environmentVariableProvider = new EnvironmentVariableProvider();

async function detectCelebrities(workerJobHelper) {
    const inputFile = workerJobHelper.getJobInput().inputFile;
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = new Buffer(workerJobHelper.getJobAssignmentId()).toString("hex");

    const params = {
        Video: { /* required */
            S3Object: {
                Bucket: inputFile.awsS3Bucket,
                Name: inputFile.awsS3Key
            }
        },
        ClientRequestToken: clientToken,
        JobTag: base64JobId,
        NotificationChannel: {
            RoleArn: environmentVariableProvider.getRequiredContextVariable("RekoSnsRoleArn"),
            SNSTopicArn: environmentVariableProvider.getRequiredContextVariable("SnsTopicArn")
        }
    };

    const data = await RekognitionStartCelebrityRecognition(params);

    Logger.debug(JSON.stringify(data, null, 2));
}

detectCelebrities.profileName = "AWSDetectCelebrities";

module.exports = {
    detectCelebrities
};