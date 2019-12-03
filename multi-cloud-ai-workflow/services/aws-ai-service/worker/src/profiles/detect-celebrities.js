const crypto = require("crypto");

const AWS = require("aws-sdk");

const Rekognition = new AWS.Rekognition();

const { EnvironmentVariableProvider } = require("@mcma/core");

const environmentVariableProvider = new EnvironmentVariableProvider();

async function detectCelebrities(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const inputFile = jobAssignmentHelper.getJobInput().inputFile;
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = new Buffer(jobAssignmentHelper.getJobAssignmentId()).toString("hex");

    logger.info("Starting celebrity detection on file '" + inputFile.awsS3Key + "' in bucket '" + inputFile.awsS3Bucket + "'");

    const params = {
        Video: {
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

    const data = await Rekognition.startCelebrityRecognition(params).promise();

    logger.debug(data);
}

module.exports = {
    detectCelebrities
};
