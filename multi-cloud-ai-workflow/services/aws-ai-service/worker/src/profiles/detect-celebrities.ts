import * as crypto from "crypto";
import * as AWS from "aws-sdk";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AIJob, ConfigVariables } from "@mcma/core";
import { AwsS3FileLocator } from "@mcma/aws-s3";

const Rekognition = new AWS.Rekognition();

const configVariables = ConfigVariables.getInstance();

export async function detectCelebrities(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocator>("inputFile");
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = Buffer.from(jobAssignmentHelper.jobAssignmentDatabaseId).toString("hex");

    logger.info("Starting celebrity detection on file '" + inputFile.key + "' in bucket '" + inputFile.bucket + "'");

    const params = {
        Video: {
            S3Object: {
                Bucket: inputFile.bucket,
                Name: inputFile.key
            }
        },
        ClientRequestToken: clientToken,
        JobTag: base64JobId,
        NotificationChannel: {
            RoleArn: configVariables.get("RekoSnsRoleArn"),
            SNSTopicArn: configVariables.get("SnsTopicArn")
        }
    };

    const data = await Rekognition.startCelebrityRecognition(params).promise();

    logger.debug(data);
}
