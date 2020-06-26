import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { awsV4Auth } from "@mcma/aws-client";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { BMContent, BMEssence } from "@local/common";

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("conform-workflow-08-register-proxy-essence", process.env.LogGroupName);


type InputEvent = {
    data: {
        bmContent: string;
        bmEssence: string;
        transformJob: string[];
    };
} & JobBaseProperties;

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

        // send update notification
        try {
            event.progress = 63;
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get transform job id
        let transformJobId = event.data.transformJob?.find(id => id);

        // in case we did note do a transcode
        if (!transformJobId) {
            return event.data.bmEssence;
        }

        // get result of transform job
        let transformJob = await resourceManager.get<Job>(transformJobId);
        let jobOutput = new JobParameterBag(transformJob.jobOutput);

        // get media info
        let outputFile = jobOutput.get<AwsS3FileLocator>("outputFile");
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;

        // acquire the registered BMContent
        let bmc = await resourceManager.get<BMContent>(event.data.bmContent);

        // create BMEssence
        let locator = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key
        });

        let bme = createBMEssence(bmc, locator, "proxy-source", "proxy-source");
//    let bme = createBMEssence(bmc, locator);

        // register BMEssence
        bme = await resourceManager.create(bme);
        if (!bme.id) {
            throw new Error("Failed to register BMEssence.");
        }

        // addin BMEssence ID
        bmc.essences.push(bme.id);

        // update BMContents
        bmc = await resourceManager.update(bmc);

        // the URL to the BMEssence with conformed media
        return bme.id;
    } catch (error) {
        logger.error("Failed to register proxy essence");
        logger.error(error.toString());
        throw new McmaException("Failed to register proxy essence", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
