import * as AWS from "aws-sdk";
import { Context } from "aws-lambda";
// @ts-ignore
import * as srtConvert from "aws-transcription-to-srt";

import { EnvironmentVariableProvider, Job, JobBaseProperties, JobParameterBag, McmaException } from "@mcma/core";
import { AuthProvider, getResourceManagerConfig, ResourceManager } from "@mcma/client";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

import { BMContent, BMEssence } from "@local/common";

const S3 = new AWS.S3();

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(getResourceManagerConfig(environmentVariableProvider), new AuthProvider().add(awsV4Auth(AWS)));
const loggerProvider = new AwsCloudWatchLoggerProvider("ai-workflow-102-register-speech-to-text-output", process.env.LogGroupName);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;

/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the text file / essence containing the conversion of the transcription to srt
 * @param {*} title of the bmEssence
 * @param {*} description of the bmEssence
 */
function createBMEssence(bmContent: BMContent, location: AwsS3FileLocator, title: string, description: string): BMEssence {
    // init bmcontent
    return new BMEssence({
        bmContent: bmContent.id,
        locations: [location],
        title,
        description
    });
}

type InputEvent = {
    input: {
        bmContent: string
    },
    data: {
        transcribeJobId: string[]
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
        let jobId = event.data.transcribeJobId.find(id => id);
        if (!jobId) {
            throw new McmaException("Failed to obtain TranscribeJobId");
        }
        // logger.info("[TranscribeJobId]:", jobId);

        // get result of ai job
        let job = await resourceManager.get<Job>(jobId);
        let jobOutput = new JobParameterBag(job.jobOutput);

        // get previous process output object
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
            throw new McmaException("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

////////////////////////////////////////////////////////////////////////////
// ORIGINAL SPEECH TO TEXT TRANSCRIPTION
////////////////////////////////////////////////////////////////////////////
        // get transcription results returned by STT service
        let transcriptionResult = JSON.parse(s3Object.Body.toString());

        // Edit timed words in transcript into one single transcription text
        let transcripts = transcriptionResult.results.transcripts;

        let transcript = "";
        for (const ts of transcripts) {
            transcript += ts.transcript;
        }
        logger.info(transcript);

        // put stt output to file in website bucket under directory ./stt
        try {
            let s3Params_stt = {
                Bucket: WebsiteBucket,
                Key: "stt/stt_output" + ".txt",
                Body: JSON.stringify(transcriptionResult, null, 2)
            };
            await S3.putObject(s3Params_stt).promise();
        } catch (error) {
            throw new McmaException("Unable to create stt file: error: " + error.message, error);
        }

        // put stt output to file in temp bucket under directory ./stt
        try {
            let s3Params_stt_temp = {
                Bucket: TempBucket,
                Key: "temp/stt_output" + ".txt",
                Body: JSON.stringify(transcriptionResult, null, 2)
            };
            await S3.putObject(s3Params_stt_temp).promise();
        } catch (error) {
            throw new McmaException("Unable to create stt file: error: " + error.message, error);
        }


////////////////////////////////////////////////////////////////////////////
// ORIGINAL SPEECH TO TEXT TRANSCRIPTION TO SRT SUBTITLES
////////////////////////////////////////////////////////////////////////////
        // Convert original STT transcription into srt subtitles
        let originalTranscriptionToSrt = srtConvert(transcriptionResult);
//    logger.info(originalTranscriptionToSrt);

        // put srt file in website bucket under directory ./srt
        try {
            let s3Params_srt = {
                Bucket: WebsiteBucket,
                Key: "srt/srt_output" + ".srt",
                Body: originalTranscriptionToSrt
            };
            await S3.putObject(s3Params_srt).promise();
        } catch (error) {
            throw new McmaException("Unable to create srt file: error: " + error.message, error);
        }

        // put srt file in website bucket under directory ./srt
        try {
            let s3Params_srt_temp = {
                Bucket: TempBucket,
                Key: "temp/srt_output" + ".srt",
                Body: originalTranscriptionToSrt
            };
            await S3.putObject(s3Params_srt_temp).promise();
        } catch (error) {
            throw new McmaException("Unable to create srt file: error: " + error.message, error);
        }


/////////////////////////////////////////////////////////////////////////////////
// EXTERNALLY EDITED AND CORRECTED SPEECH TO TEXT TRANSCRIPTION TO SRT SUBTITLES
/////////////////////////////////////////////////////////////////////////////////

        // get corrected transcription object edited externally and uploaded to websiteBucket
        // scenario 1: the file has been edited in a webapp and stored in websiteBucket
        // scenario 2: after editing the file could be stored in temp and accessed from tempBucket 
        let s3Object_stt_clean;
        try {
            s3Object_stt_clean = await S3.getObject({
                Bucket: WebsiteBucket,
                Key: "assets/stt/stt_output_clean.txt",
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to access file in bucket '" + WebsiteBucket + "' with key '" + "assets/stt/stt_output_clean" + ".txt" + "' due to error: " + error.message);
        }


        // Get corrected transcription result
        let cleanTranscriptionResult = JSON.parse(s3Object_stt_clean.Body.toString());

        // Edit timed words in corrected transcript into one single corrected transcription text
        let transcripts_clean = cleanTranscriptionResult.results.transcripts;
//    logger.info(JSON.stringify(transcripts_clean, null, 2));
        let transcript_clean = "";
        for (const ts of transcripts_clean) {
            transcript_clean += ts.transcript;
        }
//    logger.info(transcript_clean);

        // Scenario 1: copy corrected stt output to file in temp bucket under directory ./stt to be accessed by another service
        // scenario 2: the file is accessed directly from the tempBucket
        try {
            let s3Params_stt_clean_tmp = {
                Bucket: TempBucket,
                Key: "temp/stt_output_clean" + ".txt",
                Body: s3Object_stt_clean.Body.toString()
            };
            await S3.putObject(s3Params_stt_clean_tmp).promise();
        } catch (error) {
            throw new McmaException("Unable to create stt file: error: " + error.message, error);
        }

        try {
            let s3Params_stt_clean_tmp = {
                Bucket: TempBucket,
                Key: "assets/stt/stt_output_clean" + ".txt",
                Body: s3Object_stt_clean.Body.toString()
            };
            await S3.putObject(s3Params_stt_clean_tmp).promise();
        } catch (error) {
            throw new McmaException("Unable to create stt file: error: " + error.message, error);
        }


////////////////////////////////////////////////////////////////////////////
// CORRECTED / EDITED SPEECH TO TEXT TRANSCRIPTION TO SRT/VTT SUBTITLES
////////////////////////////////////////////////////////////////////////////
        // Convert corrected transcription timed words into clean srt subtitles using file in website bucket
        let cleanTranscriptionToSrt = srtConvert(cleanTranscriptionResult);
//    logger.info(cleanTranscriptionToSrt);

        try {
            let s3Params_srt_clean = {
                Bucket: WebsiteBucket,
                Key: "srt/srt_output_clean.srt",
                Body: cleanTranscriptionToSrt
            };
            await S3.putObject(s3Params_srt_clean).promise();
        } catch (error) {
            throw new McmaException("Unable to create clean srt file: error: " + error.message, error);
        }

        try {
            let s3Params_srt_clean_temp = {
                Bucket: TempBucket,
                Key: "temp/srt_output_clean.srt",
                Body: cleanTranscriptionToSrt
            };
            await S3.putObject(s3Params_srt_clean_temp).promise();
        } catch (error) {
            throw new McmaException("Unable to create clean srt file in repo: error: " + error.message, error);
        }


        // VTT Transcription pushed in final video website bucket
        let srtToVtt = "WEBVTT" + "\r\n" + "\r\n" + cleanTranscriptionToSrt;
        logger.info(srtToVtt);

        let s3Bucket_vtt = WebsiteBucket;
        let s3Key_vtt = "DubbingSrtJobResults/final" + ".vtt";

        try {
            let s3Params_vtt = {
                Bucket: s3Bucket_vtt,
                Key: s3Key_vtt,
                Body: srtToVtt
            };
            await S3.putObject(s3Params_vtt).promise();
        } catch (error) {
            throw new McmaException("Unable to create stt file: error: " + error.message, error);
        }


////////////////////////////////////////////////////////////////////////////
// ASSOCIATION OF VTT, STT AND SRT FILES (BMESSENCES) WITH BMCONTENT
////////////////////////////////////////////////////////////////////////////
        // identify current bmContent associated with workflow
        let bmContent = await resourceManager.get<BMContent>(event.input.bmContent);

////////////////////////////VTT CLEAN/CORRECTED//////////////////////////////

        let locator_vtt_clean = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket_vtt,
            awsS3Key: s3Key_vtt
        });

        // construct public https endpoint
        await getS3Url(locator_vtt_clean, S3);

        // declare new bmEssence for srt file
        let bmEssence_vtt_clean = createBMEssence(bmContent, locator_vtt_clean, "clean_vtt_output_file", "clean_vtt_output_file");

        // register BMEssence for srt file
        bmEssence_vtt_clean = await resourceManager.create(bmEssence_vtt_clean);
        if (!bmEssence_vtt_clean.id) {
            throw new McmaException("Failed to register BMEssence for VTT.");
        }

        // adding BMEssence ID for srt file as reference in bmContent
        bmContent.essences.push(bmEssence_vtt_clean.id);


///////////////////////////////////////////////////////////////////////////////
// AllOCATION OF STT AND SRT RESULTS WITH BMCONTENT PROPERTIES
///////////////////////////////////////////////////////////////////////////////
        if (!bmContent.awsAiMetadata) {
            bmContent.awsAiMetadata = {};
        }
        if (!bmContent.awsAiMetadata.transcription) {
            bmContent.awsAiMetadata.transcription = {};
        }

        if (!bmContent.awsAiMetadata.cleanTranscription) {
            bmContent.awsAiMetadata.cleanTranscription = {};
        }

        if (!bmContent.awsSrt) {
            bmContent.awsSrt = {};
        }
        if (!bmContent.awsSrt.transcription) {
            bmContent.awsSrt.transcription = {};
        }

        if (!bmContent.awsSrtClean) {
            bmContent.awsSrtClean = {};
        }
        if (!bmContent.awsSrtClean.transcription) {
            bmContent.awsSrtClean.transcription = {};
        }

        // associate srt subtitles with bm Content 
        bmContent.awsSrt.transcription.original = originalTranscriptionToSrt;
        logger.info(bmContent.awsSrt.transcription.original);

        // associate clean srt subtitles with bm Content 
        bmContent.awsSrtClean.transcription.original = cleanTranscriptionToSrt;
        logger.info(bmContent.awsSrtClean.transcription.original);

        // associate aggregated transcript with bm Content 
        bmContent.awsAiMetadata.transcription.original = transcript;
//    bmContent.awsAiMetadata.transcription.original = JSON.stringify(transcripts, null, 2);
        logger.info(bmContent.awsAiMetadata.transcription.original);

        // associate aggregated clean transcript with bm Content 
        bmContent.awsAiMetadata.cleanTranscription.original = transcript_clean;
//    bmContent.awsAiMetadata.cleanTranscription.original = JSON.stringify(transcripts_clean, null, 2);
        logger.info(bmContent.awsAiMetadata.cleanTranscription.original);

        bmContent = await resourceManager.update(bmContent);

    } catch (error) {
        logger.error("Failed to register speech to text output");
        logger.error(error.toString());
        throw new McmaException("Failed to register speech to text output", error);
    } finally {
        logger.functionEnd(context.awsRequestId);
        await loggerProvider.flush();
    }
}
