const crypto = require("crypto");

const AWS = require('aws-sdk');

const Rekognition = new AWS.Rekognition();

const { EnvironmentVariableProvider } = require("@mcma/core");

const environmentVariableProvider = new EnvironmentVariableProvider();

async function detectEmotions(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const inputFile = jobAssignmentHelper.getJobInput().inputFile;
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = Buffer.from(jobAssignmentHelper.getJobAssignmentId()).toString("hex");

    const params = {
        Video: {
            S3Object: {
                Bucket: inputFile.awsS3Bucket,
                Name: inputFile.awsS3Key
            }
        },
        ClientRequestToken: clientToken,
        FaceAttributes: "ALL",
        JobTag: base64JobId,
        NotificationChannel: {
            RoleArn: environmentVariableProvider.getRequiredContextVariable("RekoSnsRoleArn"),
            SNSTopicArn: environmentVariableProvider.getRequiredContextVariable("SnsTopicArn")
        }
    };

    const data = await Rekognition.startFaceDetection(params).promise();

    logger.debug(data);
}

module.exports = {
    detectEmotions
};
