import * as crypto from "crypto";
import * as AWS from "aws-sdk";
import { AIJob, JobParameterBag } from "@mcma/core";
import { ProviderCollection, ProcessJobAssignmentHelper } from "@mcma/worker";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";

const Rekognition = new AWS.Rekognition();

export async function detectEmotions(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = Buffer.from(jobAssignmentHelper.jobAssignmentId).toString("hex");

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
            RoleArn: providers.environmentVariableProvider.getRequiredContextVariable<string>("RekoSnsRoleArn"),
            SNSTopicArn: providers.environmentVariableProvider.getRequiredContextVariable<string>("SnsTopicArn")
        }
    };

    const data = await Rekognition.startFaceDetection(params).promise();

    logger.debug(data);
}