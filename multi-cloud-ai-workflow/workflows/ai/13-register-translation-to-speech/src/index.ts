import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";
import { BMContent, BMEssence } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-13-register-translation-to-speech", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;

type InputEvent = {
    parallelProgress?: { [key: string]: number },
    input: {
        bmContent: string;
    },
    data: {
        textToSpeechJobId: string[];
    }
} & JobBaseProperties;

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the media file
 * @param {*} title of the media file
 * @param {*} description of the media file
 * @param {*} link to media file
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
            event.parallelProgress = { "text-to-speech": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }

        // get ai job id (first non null entry in array)
        let jobId = event.data.textToSpeechJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TextToSpeechJobId");
        }
        logger.info("[TextToSpeechJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let jobInput = new JobParameterBag(job.jobInput);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // Copy textToSpeech output file to output location
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");
        // destination bucket: AIJob outputlocation
        let outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");
        let s3Bucket = outputLocation.awsS3Bucket;
        let s3Key = outputLocation.awsS3KeyPrefix;

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // source URI 
        let copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);
        // destination bucket
        let s3BucketWeb = WebsiteBucket;
        // destination filename. Add texttospeech_ to s3Key/filename to identify textToSpeech essence
        let s3KeyWeb = "media/translation/translation.mp3";
        // execute copy textToSpeech media file to websiteBucket
        try {
            let params = {
                CopySource: copySource,
                Bucket: s3BucketWeb,
                Key: s3KeyWeb,
            };
            await S3.copyObject(params).promise();
        } catch (error) {
            throw new McmaException("Unable to read input file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // create BMEssence corresponding to textToSpeech media file in websiteBucket
        // bmEssence is a locator to the essence and the associated bmContent
        let locatorWeb = new AwsS3FileLocator({
            awsS3Bucket: s3BucketWeb,
            awsS3Key: s3KeyWeb
        });
        await getS3Url(locatorWeb, S3);

        let bmEssenceWeb = createBMEssence(bmContent, locatorWeb, "text-to-speech-web", "text-to-speech-web");
        // register BMEssence to obtain bmEssence Id to provide link in bmContent
        bmEssenceWeb = await resourceManager.create(bmEssenceWeb);
        if (!bmEssenceWeb.id) {
            throw new McmaException("Failed to register bmEssenceWeb.");
        }
        // add BMEssence ID reference in bmContent array of bmEssences
        bmContent.essences.push(bmEssenceWeb.id);

        // update BMContents with reference to text-to-speech website bucket copy file
        bmContent = await resourceManager.update(bmContent);

        // adding ResultPath of StepFunctions -> CHECK USAGE!!!!!!!!!!!! WITH WEBSITE??
        return new AwsS3FileLocator({
            awsS3Bucket: s3BucketWeb,
            awsS3Key: s3KeyWeb,
        });
    } catch (error) {
        logger.error("Failed to register translation of speech");
        logger.error(error.toString());
        throw new McmaException("Failed to register translation of speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
