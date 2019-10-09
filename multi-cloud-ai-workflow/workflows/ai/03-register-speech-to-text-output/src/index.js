//"use strict";

// require
const fs = require('fs');
const util = require("util");

const fsWriteFile = util.promisify(fs.writeFile);
const CreateReadStream = util.promisify(fs.createReadStream);
const CreateWriteStream = util.promisify(fs.createWriteStream);

const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));

const srtConvert = require("aws-transcription-to-srt");
const Subtitle = require("subtitle-utils");

const { EnvironmentVariableProvider, Locator, BMEssence } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");
const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;
const TempBucket = process.env.TempBucket;
const RepositoryBucket = process.env.RepositoryBucket;


/**
 * Create New BMEssence Object
 * @param {*} bmContent the URL to the BMContent
 * @param {*} location point to copies of the text file / essence containing the conversion of the transcription to srt
 * @param {*} title of the bmEssence
 * @param {*} description of the bmEssence
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
exports.handler = async (event, context) => {
//    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "speech-text-translate": 40 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // get ai job id (first non null entry in array)
    let jobId = event.data.transcribeJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain TranscribeJobId");
    }
    // console.log("[TranscribeJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);

    // get previous process output object
    let s3Bucket = job.jobOutput.outputFile.awsS3Bucket;
    let s3Key = job.jobOutput.outputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3GetObject({
            Bucket: s3Bucket,
            Key: s3Key,
        });
    } catch (error) {
        throw new Error("Unable to access file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

////////////////////////////////////////////////////////////////////////////
// ORIGINAL SPEECH TO TEXT TRANSCRIPTION
////////////////////////////////////////////////////////////////////////////
    // get transcription results returned by STT service
    let transcriptionResult = JSON.parse(s3Object.Body.toString());
//    console.log(transcriptionResult);
//    same as
//    console.log(JSON.parse(JSON.stringify(transcriptionResult, null, 2)));

    // Edit timed words in transcript into one single transcription text
    let transcripts = transcriptionResult.results.transcripts;
//    console.log(JSON.stringify(transcripts, null, 2));
//    console.log(transcripts);

    let transcript = "";
    for (const ts of transcripts) {
        transcript += ts.transcript;
    }
//    console.log(transcript);

    // put stt output to file in website bucket under directory ./stt
    try {
            let s3Params_stt = {
                Bucket: WebsiteBucket,
                Key: "stt/stt_output" + ".txt",
                Body: JSON.stringify(transcriptionResult, null, 2)
            };
            await S3PutObject(s3Params_stt);
        } catch (error) {
            throw new Error("Unable to create stt file: error: " + error.message);
        }

    // put stt output to file in temp bucket under directory ./stt
    try {
            let s3Params_stt_temp = {
                Bucket: TempBucket,
                Key: "temp/stt_output" + ".txt",
                Body: JSON.stringify(transcriptionResult, null, 2)
            };
            await S3PutObject(s3Params_stt_temp);
        } catch (error) {
            throw new Error("Unable to create stt file: error: " + error.message);
        }

    

////////////////////////////////////////////////////////////////////////////
// ORIGINAL SPEECH TO TEXT TRANSCRIPTION TO SRT SUBTITLES
////////////////////////////////////////////////////////////////////////////
    // Convert original STT transcription into srt subtitles
    let originalTranscriptionToSrt = srtConvert(transcriptionResult);
//    console.log(originalTranscriptionToSrt);

    // put srt file in website bucket under directory ./srt
    try {
            let s3Params_srt = {
                Bucket: WebsiteBucket,
                Key: "srt/srt_output" + ".srt",
                Body: originalTranscriptionToSrt
            };
            await S3PutObject(s3Params_srt);
        } catch (error) {
            throw new Error("Unable to create srt file: error: " + error.message);
        }

    // put srt file in website bucket under directory ./srt
    try {
            let s3Params_srt_temp = {
                Bucket: TempBucket,
                Key: "temp/srt_output" + ".srt",
                Body: originalTranscriptionToSrt
            };
            await S3PutObject(s3Params_srt_temp);
        } catch (error) {
            throw new Error("Unable to create srt file: error: " + error.message);
        }



/////////////////////////////////////////////////////////////////////////////////
// EXTERNALLY EDITED AND CORRECTED SPEECH TO TEXT TRANSCRIPTION TO SRT SUBTITLES
/////////////////////////////////////////////////////////////////////////////////

    // get corrected transcription object edited externally and uploaded to websiteBucket
    // scenario 1: the file has been edited in a webapp and stored in websiteBucket
    // scenario 2: after editing the file could be stored in temp and accessed from tempBucket 
    let s3Object_stt_clean;
    try {
        s3Object_stt_clean = await S3GetObject({
            Bucket: WebsiteBucket,
            Key: "stt/stt_output_clean" + ".txt",
        });
    } catch (error) {
        throw new Error("Unable to access file in bucket '" + WebsiteBucket + "' with key '" + "stt/stt_output_clean" + ".txt" + "' due to error: " + error.message);
    }


    // Get corrected transcription result
    let cleanTranscriptionResult = JSON.parse(s3Object_stt_clean.Body.toString());

    // Edit timed words in corrected transcript into one single corrected transcription text
    let transcripts_clean = cleanTranscriptionResult.results.transcripts;
//    console.log(JSON.stringify(transcripts_clean, null, 2));
    let transcript_clean = "";
    for (const ts of transcripts_clean) {
        transcript_clean += ts.transcript;
    }
//    console.log(transcript_clean);

    // Scenario 1: copy corrected stt output to file in temp bucket under directory ./stt to be accessed by another service
    // scenario 2: the file is accessed directly from the tempBucket
    try {
            let s3Params_stt_clean_tmp = {
                Bucket: TempBucket,
                Key: "temp/stt_output_clean" + ".txt",
                Body: s3Object_stt_clean.Body.toString()
            };
            await S3PutObject(s3Params_stt_clean_tmp);
        } catch (error) {
            throw new Error("Unable to create stt file: error: " + error.message);
        }

    try {
            let s3Params_stt_clean_tmp = {
                Bucket: TempBucket,
                Key: "stt/stt_output_clean" + ".txt",
                Body: s3Object_stt_clean.Body.toString()
            };
            await S3PutObject(s3Params_stt_clean_tmp);
        } catch (error) {
            throw new Error("Unable to create stt file: error: " + error.message);
        }


////////////////////////////////////////////////////////////////////////////
// CORRECTED / EDITED SPEECH TO TEXT TRANSCRIPTION TO SRT/VTT SUBTITLES
////////////////////////////////////////////////////////////////////////////
    // Convert corrected transcription timed words into clean srt subtitles using file in website bucket
    let cleanTranscriptionToSrt = srtConvert(cleanTranscriptionResult);
//    console.log(cleanTranscriptionToSrt);

    try {
            let s3Params_srt_clean = {
                Bucket: WebsiteBucket,
                Key: "srt/srt_output_clean.srt",
                Body: cleanTranscriptionToSrt
            };
            await S3PutObject(s3Params_srt_clean);
        } catch (error) {
            throw new Error("Unable to create clean srt file: error: " + error.message);
        }

    try {
            let s3Params_srt_clean_temp = {
                Bucket: TempBucket,
                Key: "temp/srt_output_clean.srt",
                Body: cleanTranscriptionToSrt
            };
            await S3PutObject(s3Params_srt_clean_temp);
        } catch (error) {
            throw new Error("Unable to create clean srt file in repo: error: " + error.message);
        }


    // VTT Transcription pushed in final video website bucket
    // let srtToVtt = Subtitle.fromSRT(cleanTranscriptionToSrt).toVTT();
    let srtToVtt = "WEBVTT" + "\r\n" + "\r\n" + cleanTranscriptionToSrt;
    console.log(srtToVtt);

    s3Bucket_vtt = WebsiteBucket;
    s3Key_vtt = "DubbingSrtJobResults/final" + ".vtt";

    try {
            let s3Params_vtt = {
                Bucket: s3Bucket_vtt,
                Key: s3Key_vtt,
                Body: srtToVtt
            };
            await S3PutObject(s3Params_vtt);
        } catch (error) {
            throw new Error("Unable to create stt file: error: " + error.message);
        }


////////////////////////////////////////////////////////////////////////////
// ASSOCIATION OF VTT, STT AND SRT FILES (BMESSENCES) WITH BMCONTENT
////////////////////////////////////////////////////////////////////////////
    // identify current bmContent associated with workflow
    let bmContent = await resourceManager.resolve(event.input.bmContent);

////////////////////////////VTT CLEAN/CORRECTED//////////////////////////////

    // construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket_vtt + "/" + s3Key_vtt;    // create new locator for file srt_output_clean.srt

    let locator_vtt_clean = new Locator({
        awsS3Bucket: s3Bucket_vtt,
        awsS3Key: s3Key_vtt,
        httpEndpoint: httpEndpoint_web
    });

    // declare new bmEssence for srt file
    let bmEssence_vtt_clean = createBMEssence(bmContent, locator_vtt_clean, "clean_vtt_output_file", "clean_vtt_output_file");

    // register BMEssence for srt file
    bmEssence_vtt_clean = await resourceManager.create(bmEssence_vtt_clean);
    if (!bmEssence_vtt_clean.id) {
        throw new Error("Failed to register BMEssence for VTT.");
    }

    // adding BMEssence ID for srt file as reference in bmContent
    bmContent.bmEssences.push(bmEssence_vtt_clean.id);


///////////////////////////////////////////////////////////////////////////////
// AllOCATION OF STT AND SRT RESULTS WITH BMCONTENT PROPERTIES
///////////////////////////////////////////////////////////////////////////////
    if (!bmContent.awsAiMetadata) {
        bmContent.awsAiMetadata = {};
    }
    if (!bmContent.awsAiMetadata.transcription) {
        bmContent.awsAiMetadata.transcription = {}
    }

    if (!bmContent.awsAiMetadata.cleanTranscription) {
        bmContent.awsAiMetadata.cleanTranscription = {}
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
    console.log(bmContent.awsSrt.transcription.original);

    // associate clean srt subtitles with bm Content 
    bmContent.awsSrtClean.transcription.original = cleanTranscriptionToSrt;
    console.log(bmContent.awsSrtClean.transcription.original);

    // associate aggregated transcript with bm Content 
    bmContent.awsAiMetadata.transcription.original = transcript;
//    bmContent.awsAiMetadata.transcription.original = JSON.stringify(transcripts, null, 2);
    console.log(bmContent.awsAiMetadata.transcription.original);

    // associate aggregated clean transcript with bm Content 
    bmContent.awsAiMetadata.cleanTranscription.original = transcript_clean;
//    bmContent.awsAiMetadata.cleanTranscription.original = JSON.stringify(transcripts_clean, null, 2);
    console.log(bmContent.awsAiMetadata.cleanTranscription.original);

    bmContent = await resourceManager.update(bmContent);

}
