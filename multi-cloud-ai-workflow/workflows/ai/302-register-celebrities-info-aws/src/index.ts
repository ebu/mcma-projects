import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { AIJob, EnvironmentVariableProvider, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-302-register-celebrities-info-aws", process.env.LogGroupName);

type InputEvent = {
    input: {
        bmContent: string
    },
    data: {
        awsCelebritiesJobId: string[]
    }
} & JobBaseProperties;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
export async function handler(event: InputEvent, context: Context) {
    const logger = loggerProvider.get(context.awsRequestId, event.tracker);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        // send update notification
        try {
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.awsCelebritiesJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain awsCelebritiesJobId");
        }

        let job = await resourceManager.get<AIJob>(jobId);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // get celebrities info
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;
        let s3Object;
        try {
            s3Object = await S3.getObject({
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to load celebrities info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        let celebritiesResult = JSON.parse(s3Object.Body.toString());

        let celebritiesMap: any = {};
        const timestampTolerance = 3000;
        const confidenceTolerance = 75;
        for (let j = 0; j < celebritiesResult.length;) {
            let celebrity = celebritiesResult[j];
            let prevCelebrity = celebritiesMap[celebrity.Celebrity.Name];
            if ((!prevCelebrity || celebrity.Timestamp - prevCelebrity.Timestamp > timestampTolerance) && celebrity.Celebrity.Confidence > confidenceTolerance) {
                celebritiesMap[celebrity.Celebrity.Name] = celebrity;
                j++;
            } else {
                celebritiesResult.splice(j, 1);
            }
        }

        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }

        bmContent.awsAiMetadata.celebrities = celebritiesResult;

        await resourceManager.update(bmContent);
    } catch (error) {
        logger.error("Failed to register celebrities info");
        logger.error(error.toString());
        throw new McmaException("Failed to register celebrities info", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
