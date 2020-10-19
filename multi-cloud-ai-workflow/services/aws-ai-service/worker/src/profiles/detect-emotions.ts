import * as crypto from "crypto";
import * as AWS from "aws-sdk";
import { AIJob, EnvironmentVariables } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";

const Rekognition = new AWS.Rekognition();

const environmentVariables = EnvironmentVariables.getInstance();

export async function detectEmotions(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = Buffer.from(jobAssignmentHelper.jobAssignmentDatabaseId).toString("hex");

    const params = {
        Video: {
            S3Object: {
                Bucket: inputFile.bucket,
                Name: inputFile.key
            }
        },
        ClientRequestToken: clientToken,
        FaceAttributes: "ALL",
        JobTag: base64JobId,
        NotificationChannel: {
            RoleArn: environmentVariables.get("RekoSnsRoleArn"),
            SNSTopicArn: environmentVariables.get("SnsTopicArn")
        }
    };

    const data = await Rekognition.startFaceDetection(params).promise();

    logger.debug(data);
}
