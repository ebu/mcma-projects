import * as crypto from "crypto";
import * as AWS from "aws-sdk";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AIJob } from "@mcma/core";
import { AwsS3FileLocator } from "@mcma/aws-s3";

const Rekognition = new AWS.Rekognition();

export async function detectCelebrities(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocator>("inputFile");
    const clientToken = crypto.randomBytes(16).toString("hex");
    const base64JobId = Buffer.from(jobAssignmentHelper.jobAssignmentId).toString("hex");

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
            RoleArn: providers.contextVariableProvider.getRequiredContextVariable<string>("RekoSnsRoleArn"),
            SNSTopicArn: providers.contextVariableProvider.getRequiredContextVariable<string>("SnsTopicArn")
        }
    };

    const data = await Rekognition.startCelebrityRecognition(params).promise();

    logger.debug(data);
}
