import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";

import { v4 as uuidv4 } from "uuid";

import { Job, JobParameterBag, McmaException, McmaTracker } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { BMContent, BMEssence } from "@local/common";

const { RepositoryBucket } = process.env;

const s3 = new AWS.S3();

const resourceManager = new ResourceManager(getResourceManagerConfig(), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-402-register-extract-audio-google", process.env.LogGroupName);

type InputEvent = {
    input: {
        bmContent: string
    }
    data: {
        extractAudioJobId: string[]
    }
    tracker?: McmaTracker
}

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} title of the media file
 * @param {*} description of the media file
 */
function createBMEssence(bmContent: BMContent, location: AwsS3FileLocator, title: string, description: string): BMEssence {
    // init bmcontent
    let bmEssence = new BMEssence({
        bmContent: bmContent.id,
        locations: [location],
        title: title,
        description: description,
    });
    return bmEssence;
}

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

        let [jobId] = event.data.extractAudioJobId;
        if (!jobId) {
            throw new McmaException("Failed to obtain extractAudioJobId");
        }
        logger.info("[ExtractAudioJobId]: " + jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(job);

        let jobOutput = new JobParameterBag(job.jobOutput);

        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        logger.info("outputFile: " + outputFile);

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.bucket;
        let s3Key = outputFile.key;
        logger.info("s3Bucket:" + s3Bucket);
        logger.info("s3Key:" + s3Key);

        const target = new AwsS3FileLocator({
            bucket: RepositoryBucket,
            key: uuidv4() + s3Key.substring(s3Key.lastIndexOf(".")),
        });

        await s3.copyObject({
            Bucket: target.bucket,
            Key: target.key,
            CopySource: await getS3Url(outputFile, s3),
        }).promise();

        // acquire the registered BMContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // create BMEssence
        let bmEssence = createBMEssence(bmContent, target, "audio-google", "audio-google");

        // register BMEssence
        bmEssence = await resourceManager.create(bmEssence);

        // addin BMEssence ID
        bmContent.essences.push(bmEssence.id);
        logger.info("bmContent", bmContent);

        // update BMContents
        bmContent = await resourceManager.update(bmContent);
        logger.info("bmContent", bmContent);

        // the URL to the BMEssence with dubbed audio file and srt
        return target;
    } catch (error) {
        logger.error("Failed to register extract audio google");
        logger.error(error.toString());
        throw new McmaException("Failed to register extract audio google", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
