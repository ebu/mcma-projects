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
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-17-register-ssml-translation-to-speech", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const RepositoryBucket = process.env.RepositoryBucket;
const TempBucket = process.env.TempBucket;

type InputEvent = {
    parallelProgress?: { [key: string]: number };
    input: {
        bmContent: string;
    };
    data: {
        ssmlTextToSpeechJobId: string[];
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
            event.parallelProgress = { "ssml-translation-to-speech": 80 };
            await resourceManager.sendNotification(event);
        } catch (error) {
            logger.warn("Failed to send notification");
            logger.warn(error.toString());
        }


        // get ai job id (first non null entry in array)
        let jobId = event.data.ssmlTextToSpeechJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain ssmlTranslationToSpeechJobId");
        }
        logger.info("[SsmlTextToSpeechJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        logger.info(JSON.stringify(job, null, 2));

        let jobOutput = new JobParameterBag(job.jobOutput);

        // Copy ssmlTextToSpeech output file to output location
        let outputFile = jobOutput.get<AwsS3FileLocatorProperties>("outputFile");

        // destination bucket: AIJob outputlocation
        let s3Bucket = outputFile.awsS3Bucket;
        let s3Key = outputFile.awsS3Key;

        // identify associated bmContent
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

        // construct public https endpoint
        let data = await S3.getBucketLocation({ Bucket: s3Bucket }).promise();
        // logger.info(JSON.stringify(data, null, 2));
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";

        // update BMContents with reference to text-to-speech output source file
        bmContent = await resourceManager.update(bmContent);

        // source URI already defined
        let copySource = encodeURI(outputFile.awsS3Bucket + "/" + outputFile.awsS3Key);

        // destination bucket - temp for ffmpeg assembly
        let s3Bucket_temp = TempBucket;
        let s3Key_temp = "temp/ssmlTranslation.mp3";
        try {
            let params_temp = {
                CopySource: copySource,
                Bucket: s3Bucket_temp,
                Key: s3Key_temp,
            };
            await S3.copyObject(params_temp).promise();
        } catch (error) {
            throw new McmaException("Unable to read input file in bucket '" + s3Bucket_temp + "' with key '" + s3Key_temp + "' due to error: " + error.message);
        }

        // destination bucket - website bucket
        let s3Bucket_web = WebsiteBucket;
        let s3Key_web = "media/ssmlTranslation/ssmlTranslation.mp3";
        try {
            let params_web = {
                CopySource: copySource,
                Bucket: s3Bucket_web,
                Key: s3Key_web,
            };
            await S3.copyObject(params_web).promise();
        } catch (error) {
            throw new McmaException("Unable to read input file in bucket '" + s3Bucket_web + "' with key '" + s3Key_web + "' due to error: " + error.message);
        }

        // create BMEssence corresponding to speechToText media file in websiteBucket
        // bmEssence is a locator to the essence and the associated bmContent
        let locator_web = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket_web,
            awsS3Key: s3Key_web
        });
        await getS3Url(locator_web, s3SubDomain);

        let bmEssence_web = createBMEssence(bmContent, locator_web, "ssml-text-to-speech-web", "ssml-text-to-speech-web");

        // register BMEssence to obtain bmEssence Id to provide link in bmContent
        bmEssence_web = await resourceManager.create(bmEssence_web);
        if (!bmEssence_web.id) {
            throw new McmaException("Failed to register BMEssence_web.");
        }

        // add BMEssence ID reference in bmContent array of bmEssences
        bmContent.essences.push(bmEssence_web.id);

        // update BMContents with reference to text-to-speech website bucket copy file
        bmContent = await resourceManager.update(bmContent);

        // adding ResultPath of StepFunctions -> CHECK USAGE!!!!!!!!!!!! WITH WEBSITE??
        return new AwsS3FileLocator({
            awsS3Bucket: s3Bucket_web,
            awsS3Key: s3Key_web,
//       httpEndpoint: httpEndpoint
        });

    } catch (error) {
        logger.error("Failed to register ssml translation of speech");
        logger.error(error.toString());
        throw new McmaException("Failed to register ssml translation of speech", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
