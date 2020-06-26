import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator, AwsS3FileLocatorProperties } from "@mcma/aws-s3";
import { BMContent, BMEssence } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-05-register-technical-metadata", process.env.LogGroupName);

type InputEvent = {
    input: {
        metadata: {
            name: string;
            description: string;
        };
        inputFile: AwsS3FileLocator;
    };
    data: {
        bmContent: string;
        ameJobId: string[];
        repositoryFile: AwsS3FileLocator;
    };
} & JobBaseProperties;

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} mediainfo json output from media info
 */
function createBMEssence(bmContent: BMContent, location: AwsS3FileLocator, mediainfo: any) {
    // init bmcontent
    let bmEssence = new BMEssence({
        bmContent: bmContent.id,
        locations: [location],
        technicalMetadata: mediainfo,
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

        // send update notification
        try {
            event.progress = 36;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ame job id
        let ameJobId = event.data.ameJobId.find(id => id);
        if (!ameJobId) {
            throw new McmaException("Failed to obtain AmeJob ID");
        }
        logger.info("[AmeJobID]:", ameJobId);

        // get result of ame job
        let ameJob = await resourceManager.get<Job>(ameJobId);
        let jobOutput = new JobParameterBag(ameJob.jobOutput);

        // get media info
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
            throw new McmaException("Unable to media info file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }
        let mediainfo = JSON.parse(s3Object.Body.toString());

        // acquire the registered BMContent
        let bmc = await resourceManager.get<BMContent>(event.data.bmContent);

        logger.info("[BMContent]:", JSON.stringify(bmc, null, 2));

        // create BMEssence
        let bme = createBMEssence(bmc, event.data.repositoryFile, mediainfo);

        // register BMEssence
        bme = await resourceManager.create(bme);
        if (!bme.id) {
            throw new McmaException("Failed to register BMEssence.");
        }
        logger.info("[BMEssence ID]:", bme.id);

        // append BMEssence ID to BMContent
        bmc.essences.push(bme.id);

        // update BMContents
        bmc = await resourceManager.update(bmc);

        // return the URL to the BMEssense
        return bme.id;
    } catch (error) {
        logger.error("Failed to register technical metadata");
        logger.error(error.toString());
        throw new McmaException("Failed to register technical metadata", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
