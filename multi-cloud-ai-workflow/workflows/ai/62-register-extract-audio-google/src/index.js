//"use strict";

// require
const util = require("util");
const speech = require("@google-cloud/speech");


const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));

const { EnvironmentVariableProvider, BMEssence, Locator } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

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
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 63;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    let jobId = event.data.extractAudioJobId.find(id => id);
    if (!jobId) {
        throw new Error("Failed to obtain extractAudioJobId");
    }
    console.log("[ExtractAudioJobId]:", jobId);

    // get result of ai job
    let job = await resourceManager.resolve(jobId);
    console.log(JSON.stringify(job, null, 2));

    let outputFile = job.jobOutput.outputFile;
    console.log("outputFile:", outputFile);

    // destination bucket: AIJob outputlocation
    let s3Bucket = outputFile.awsS3Bucket;
    let s3Key = outputFile.awsS3Key;
    console.log("s3Bucket:", s3Bucket);
    console.log("s3Key:", s3Key);

// construct public https endpoint
    let data = await S3GetBucketLocation({ Bucket: s3Bucket });
    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
    let httpEndpoint_web = "https://" + s3SubDomain + ".amazonaws.com/" + s3Bucket + "/" + s3Key;
    let mediaFileUri = "https://" + s3SubDomain + ".amazonaws.com/" + outputFile.awsS3Bucket + "/" + outputFile.awsS3Key;
    console.log("httpEndpoint_web", httpEndpoint_web);
    console.log("mediaFileUri", mediaFileUri);

    // Speech to Text
    console.log("##############");
    console.log("Speech to Text");
    console.log("##############");

    // Creates a client
    const client = new speech.SpeechClient({
        credentials: {
            client_email: 'mcma-storage-admin@mcma-sandbox.iam.gserviceaccount.com',
            private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCZFBKFxk9J5FF7\ngLGVdIqB7qSHFql0IqNfaTYx82fS+HAm5yLn1eDZ8+WebnNQrjr2UpJ5xIl9m8G8\nbcLEwyXymaGqXMMT0WTr8JolqPoQWHDUGVKvwSDlq8R4XH79rwcCUjdOJuQ+JX/4\nDqFm4pNp9GjlYXtHqQhZpr3CtVN1bD4G4Js4kNNc+TEv4d+G/Kh3E2599hoYibIk\nApEWijxh6ki87qTCt7Us976mZNXUzmVaOJlRe88BjXe9aoUu1ZTXds16S3s9Iqps\nrSd9Ie7ZfX27Sea9yT345iCTwXa1x4pmpJ3wuzCTko3YjoDtcJpI1ezXlSuai3yM\nB7/RUkCjAgMBAAECggEAQR4LRRHXb7jquo1Dva5+Lwh7v6Vxvx/u/GrOrY/75gBe\nAQaI0DMou75nOq6Ealk7ZsY4XgkvbZng342XcUkMbvdQkJ52M4t7EWzfvc50VZix\nomAFTxNqMZkQchzyvmqCokekFCAyLoeYOMbMfO48RDG+n3kIzrKGhVCLX3TwBD42\n8w+e/OujowDPfRDzmbhTU0UhLIZ0r0jIxZjhE7131VxQ7jK9Q1LNCPXxzYgk7azZ\nHqtbuukU6QQFgC+c0HIZgHxcVXulZ830il4z7T9XkAIIxbn+aUQmtPmoNFn7cZF2\nbaAYwNthvYMds6/3g+zbSDJmqL2TGxAY9K4j2oxUuQKBgQDWDDmFuSGfcboDwIed\nkjmFikYpzZG+Bqqdywl+dPcwTygW+V3oh1AVJJpAwEvc+06/wNmC2x3YCMgQzi1y\nlkCzkX/CkdzZ+mnop5e8r4byETEFOsbXHr4haUTPz/5MnqRGxjU1nGXE7q3lPR7o\nZjRyTWOffRjX08Lu4psN1kOL+wKBgQC3FLscaqTBfMP8q938kL/gS1/57mR3yRzP\nR+tVd2N+bVOCDFUHmmUJcp0mAbzroM+uPDtB/GUZ8XUsMzZllYwm/NN3Q+kRiudU\nEyz8itOKdYno2/I/nxfk5iC7p+eoilOR3yhMPEFg2vw4L2UwoICbU16Dxy3d9zq/\n0d1FMQSVeQKBgHR2Dk4t3pdsP3OPK7qWNunrxCU2jlfANNDKCg5eAaitSPjHEUtV\nZEM8uRkGB8Dik4RNn4tNQT2r+X77T0sLaYTKY6MvzeRkFX/av/qP3nKS3AMmac3e\nEkEHj8MqPgjeQC+p5IWY5N5zpvYVfV2hTmPqq4u5euzjcSqc7RRoQjRFAoGAdRBT\naCMkf/e4FasLgUBJADESCGyPXyyAOGXjKz3wp1leaSxbfkYRzs2zgCbiVsP3p5Ap\nz9KEDueepYmFgcTy3ccRrBQHRklMCy1LuZtHEiR/7x4cMuQWUi13xqXg8ZqpPv+y\n87Qflb/QQFjF2ib2tNrE93v3bxNzRE37rw9dv/kCgYEAnhXyUlcDdMTK2HvWPU1c\nPovX36aK9cHKoBeS7G2vypwezEsTGbA8kXghQApoKXvsnvg+rD3F93ujtHpkLeNH\nOUWmbe8e9RGAqlZ58sEfCCIvpRe5Q4ir5igyc6cpEH2i0sO4np2wejUbwnVHDcML\nCqB9uAWzB/gICp2g/5G6Cu8=\n-----END PRIVATE KEY-----\n',
        },
        projectId: "mcma-sandbox"
    });

    const gcsUri = 'gs://mcma-gcp-speech-to-text/extractedAudio.flac';
    const encoding = 'FLAC';
    const sampleRateHertz = 48000;
    const languageCode = 'en-US';

    const config = {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        audioChannelCount: 2,
    };

    const audio = {
        uri: gcsUri,
    };

    const request = {
        config: config,
        audio: audio,
    };

    // Detects speech in the audio file. This creates a recognition job that you
    // can wait for now, or get its result later.
    const [operation] = await client.longRunningRecognize(request);
    // Get a Promise representation of the final result of the job
    const [response] = await operation.promise();
    console.log(`response: ${response}`);

    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    console.log(`Transcription: ${transcription}`);

    const projectId = client.getProjectId();
    console.log(projectId);

    // Speech to Text
    console.log("##################");
    console.log("Speech to Text END");
    console.log("##################");


    // acquire the registered BMContent
    let bmContent = await resourceManager.resolve(event.input.bmContent);

    if (!bmContent.googleAiMetadata) {
        bmContent.googleAiMetadata = {};
    }

    bmContent.googleAiMetadata.transcription = transcription;

    // create BMEssence
    let locator = new Locator({
        "awsS3Bucket": s3Bucket,
        "awsS3Key": s3Key,
        "httpEndpoint": httpEndpoint_web
    });

    let bmEssence = createBMEssence(bmContent, locator, "audio-google", "audio-google");

    // register BMEssence
    bmEssence = await resourceManager.create(bmEssence);
    if (!bmEssence.id) {
        throw new Error("Failed to register BMEssence.");
    }

    // addin BMEssence ID
    bmContent.bmEssences.push(bmEssence.id);
    console.log("bmContent", bmContent);

    // update BMContents
    bmContent = await resourceManager.update(bmContent);
    console.log("bmContent", bmContent);

    // the URL to the BMEssence with dubbed audio file and srt
    return bmEssence.id;
}