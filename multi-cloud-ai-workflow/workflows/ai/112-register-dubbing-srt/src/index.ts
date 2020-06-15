import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent, BMEssence } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-112-register-dubbing-srt", process.env.LogGroupName);

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        dubbingSrtJobId: string[];
    };
} & JobBaseProperties;

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} title of the media file
 * @param {*} description of the media file
 */
function createBMEssence(bmContent, location, title, description) {
    // init bmcontent
    let bmEssence = new BMEssence({
        "bmContent": bmContent.id,
        "locations": [location],
        "title": title,
        "description": description,
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

        let jobId = event.data.dubbingSrtJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain ssmlTranslationToSpeechJobId");
        }
        logger.info("[DubbingSrtJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let jobOutput = new JobParameterBag(job.jobOutput);

        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;

        // acquire the registered BMContent
        let bmc = await resourceManager.get<BMContent>(event.input.bmContent);

        // create BMEssence
        let locator = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key
        });
        await getS3Url(locator, S3);

        let bme = createBMEssence(bmc, locator, "dubbing-srt-output", "dubbing-srt-output");

        // register BMEssence
        bme = await resourceManager.create(bme);
        if (!bme.id) {
            throw new McmaException("Failed to register BMEssence.");
        }

        // addin BMEssence ID
        bmc.essences.push(bme.id);

        // update BMContents
        bmc = await resourceManager.update(bmc);

        // the URL to the BMEssence with dubbed audio file and srt
        return bme.id;
    } catch (error) {
        logger.error("Failed to register dubbing SRT");
        logger.error(error.toString());
        throw new McmaException("Failed to register dubbing SRT", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
