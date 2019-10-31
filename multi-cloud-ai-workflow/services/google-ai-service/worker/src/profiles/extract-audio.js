const util = require("util");

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { Logger, Locator } = require("mcma-core");
const { ffmpeg } = require("../ffmpeg");

const speech = require("@google-cloud/speech");
const { Storage } = require('@google-cloud/storage');



async function extractAudio(workerJobHelper) {

    Logger.debug("########################");
    Logger.debug("extract-audio.js - START");
    Logger.debug("########################");

    const jobInput = workerJobHelper.getJobInput();
    const googleProjectId = workerJobHelper.getRequest().getRequiredContextVariable("googleProjectId");
    const googleBucketName = workerJobHelper.getRequest().getRequiredContextVariable("googleBucketName");
    const googleClientEmail = workerJobHelper.getRequest().getRequiredContextVariable("googleClientEmail");
    const googlePrivateKey = workerJobHelper.getRequest().getRequiredContextVariable("googlePrivateKey");

    console.log('googleProjectId', googleProjectId);
    console.log('googleBucketName', googleBucketName);
    console.log('googleClientEmail', googleClientEmail);
    console.log('googlePrivateKey', googlePrivateKey);

    Logger.debug("61. Extract audio track from mp4 source using ffmpeg");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        Logger.debug("61.1. obtain content from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        Logger.debug("61.2. write copy of proxy input file to local ffmpeg tmp storage");
        // the tmp directory is local to the ffmpeg running instance
        const input = "/tmp/" + "proxy_google.mp4";
        await fsWriteFile(input, data.Body);

        Logger.debug("61.3. declare ffmpeg outputs");
        output = "/tmp/" + "extractedAudio.flac";

        Logger.debug("61.4. extract audio track");
        // ffmpeg -i input_video.mp4 -vn output_audio.mp3
        const params_extract_audio = ["-i", input, output];

        await ffmpeg(params_extract_audio);

        console.log("#####################");
        console.log("GOOGLE BUCKET - START");
        console.log("#####################");

        const storage = new Storage({
            credentials: {
                client_email: googleClientEmail,
                private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCZFBKFxk9J5FF7\ngLGVdIqB7qSHFql0IqNfaTYx82fS+HAm5yLn1eDZ8+WebnNQrjr2UpJ5xIl9m8G8\nbcLEwyXymaGqXMMT0WTr8JolqPoQWHDUGVKvwSDlq8R4XH79rwcCUjdOJuQ+JX/4\nDqFm4pNp9GjlYXtHqQhZpr3CtVN1bD4G4Js4kNNc+TEv4d+G/Kh3E2599hoYibIk\nApEWijxh6ki87qTCt7Us976mZNXUzmVaOJlRe88BjXe9aoUu1ZTXds16S3s9Iqps\nrSd9Ie7ZfX27Sea9yT345iCTwXa1x4pmpJ3wuzCTko3YjoDtcJpI1ezXlSuai3yM\nB7/RUkCjAgMBAAECggEAQR4LRRHXb7jquo1Dva5+Lwh7v6Vxvx/u/GrOrY/75gBe\nAQaI0DMou75nOq6Ealk7ZsY4XgkvbZng342XcUkMbvdQkJ52M4t7EWzfvc50VZix\nomAFTxNqMZkQchzyvmqCokekFCAyLoeYOMbMfO48RDG+n3kIzrKGhVCLX3TwBD42\n8w+e/OujowDPfRDzmbhTU0UhLIZ0r0jIxZjhE7131VxQ7jK9Q1LNCPXxzYgk7azZ\nHqtbuukU6QQFgC+c0HIZgHxcVXulZ830il4z7T9XkAIIxbn+aUQmtPmoNFn7cZF2\nbaAYwNthvYMds6/3g+zbSDJmqL2TGxAY9K4j2oxUuQKBgQDWDDmFuSGfcboDwIed\nkjmFikYpzZG+Bqqdywl+dPcwTygW+V3oh1AVJJpAwEvc+06/wNmC2x3YCMgQzi1y\nlkCzkX/CkdzZ+mnop5e8r4byETEFOsbXHr4haUTPz/5MnqRGxjU1nGXE7q3lPR7o\nZjRyTWOffRjX08Lu4psN1kOL+wKBgQC3FLscaqTBfMP8q938kL/gS1/57mR3yRzP\nR+tVd2N+bVOCDFUHmmUJcp0mAbzroM+uPDtB/GUZ8XUsMzZllYwm/NN3Q+kRiudU\nEyz8itOKdYno2/I/nxfk5iC7p+eoilOR3yhMPEFg2vw4L2UwoICbU16Dxy3d9zq/\n0d1FMQSVeQKBgHR2Dk4t3pdsP3OPK7qWNunrxCU2jlfANNDKCg5eAaitSPjHEUtV\nZEM8uRkGB8Dik4RNn4tNQT2r+X77T0sLaYTKY6MvzeRkFX/av/qP3nKS3AMmac3e\nEkEHj8MqPgjeQC+p5IWY5N5zpvYVfV2hTmPqq4u5euzjcSqc7RRoQjRFAoGAdRBT\naCMkf/e4FasLgUBJADESCGyPXyyAOGXjKz3wp1leaSxbfkYRzs2zgCbiVsP3p5Ap\nz9KEDueepYmFgcTy3ccRrBQHRklMCy1LuZtHEiR/7x4cMuQWUi13xqXg8ZqpPv+y\n87Qflb/QQFjF2ib2tNrE93v3bxNzRE37rw9dv/kCgYEAnhXyUlcDdMTK2HvWPU1c\nPovX36aK9cHKoBeS7G2vypwezEsTGbA8kXghQApoKXvsnvg+rD3F93ujtHpkLeNH\nOUWmbe8e9RGAqlZ58sEfCCIvpRe5Q4ir5igyc6cpEH2i0sO4np2wejUbwnVHDcML\nCqB9uAWzB/gICp2g/5G6Cu8=\n-----END PRIVATE KEY-----\n',
            },
            projectId: googleProjectId
        });

        let bucketExists = false;
        await storage.getBuckets().then(buckets => {
            for (let bucket of buckets[0]) {
                if (bucket['id'] === googleBucketName) {
                    bucketExists = true;
                }
            }
        });

        if (bucketExists === false) {
            await storage.createBucket(googleBucketName, {
                location: 'eu',
                storageClass: 'Standard',
            });
            console.log(`Bucket ${googleBucketName} created.`);
        } else {
            console.log(`Bucket ${googleBucketName} already exists.`);
        }

        await storage.bucket(googleBucketName).upload(output, {
            resumable: false,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            },
        });
        Logger.debug(`61.5. ${output} uploaded to ${googleBucketName}.`);

        console.log("###################");
        console.log("GOOGLE BUCKET - END");
        console.log("###################");

        Logger.debug("61.6. removing file from ffmpeg local temp repo");
        await fsUnlink(input);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    Logger.debug("61.7. Writing ffmpeg output to output location");
    // const s3Params = {
    //     Bucket: outputLocation.awsS3Bucket,
    //     Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "audioGoogle.flac",
    //     Body: await fsReadFile(output)
    // };
    // await S3PutObject(s3Params);

    console.log("######################");
    console.log("Speech to Text - START");
    console.log("######################");

    const client = new speech.SpeechClient({
        credentials: {
            client_email: googleClientEmail,
            private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCZFBKFxk9J5FF7\ngLGVdIqB7qSHFql0IqNfaTYx82fS+HAm5yLn1eDZ8+WebnNQrjr2UpJ5xIl9m8G8\nbcLEwyXymaGqXMMT0WTr8JolqPoQWHDUGVKvwSDlq8R4XH79rwcCUjdOJuQ+JX/4\nDqFm4pNp9GjlYXtHqQhZpr3CtVN1bD4G4Js4kNNc+TEv4d+G/Kh3E2599hoYibIk\nApEWijxh6ki87qTCt7Us976mZNXUzmVaOJlRe88BjXe9aoUu1ZTXds16S3s9Iqps\nrSd9Ie7ZfX27Sea9yT345iCTwXa1x4pmpJ3wuzCTko3YjoDtcJpI1ezXlSuai3yM\nB7/RUkCjAgMBAAECggEAQR4LRRHXb7jquo1Dva5+Lwh7v6Vxvx/u/GrOrY/75gBe\nAQaI0DMou75nOq6Ealk7ZsY4XgkvbZng342XcUkMbvdQkJ52M4t7EWzfvc50VZix\nomAFTxNqMZkQchzyvmqCokekFCAyLoeYOMbMfO48RDG+n3kIzrKGhVCLX3TwBD42\n8w+e/OujowDPfRDzmbhTU0UhLIZ0r0jIxZjhE7131VxQ7jK9Q1LNCPXxzYgk7azZ\nHqtbuukU6QQFgC+c0HIZgHxcVXulZ830il4z7T9XkAIIxbn+aUQmtPmoNFn7cZF2\nbaAYwNthvYMds6/3g+zbSDJmqL2TGxAY9K4j2oxUuQKBgQDWDDmFuSGfcboDwIed\nkjmFikYpzZG+Bqqdywl+dPcwTygW+V3oh1AVJJpAwEvc+06/wNmC2x3YCMgQzi1y\nlkCzkX/CkdzZ+mnop5e8r4byETEFOsbXHr4haUTPz/5MnqRGxjU1nGXE7q3lPR7o\nZjRyTWOffRjX08Lu4psN1kOL+wKBgQC3FLscaqTBfMP8q938kL/gS1/57mR3yRzP\nR+tVd2N+bVOCDFUHmmUJcp0mAbzroM+uPDtB/GUZ8XUsMzZllYwm/NN3Q+kRiudU\nEyz8itOKdYno2/I/nxfk5iC7p+eoilOR3yhMPEFg2vw4L2UwoICbU16Dxy3d9zq/\n0d1FMQSVeQKBgHR2Dk4t3pdsP3OPK7qWNunrxCU2jlfANNDKCg5eAaitSPjHEUtV\nZEM8uRkGB8Dik4RNn4tNQT2r+X77T0sLaYTKY6MvzeRkFX/av/qP3nKS3AMmac3e\nEkEHj8MqPgjeQC+p5IWY5N5zpvYVfV2hTmPqq4u5euzjcSqc7RRoQjRFAoGAdRBT\naCMkf/e4FasLgUBJADESCGyPXyyAOGXjKz3wp1leaSxbfkYRzs2zgCbiVsP3p5Ap\nz9KEDueepYmFgcTy3ccRrBQHRklMCy1LuZtHEiR/7x4cMuQWUi13xqXg8ZqpPv+y\n87Qflb/QQFjF2ib2tNrE93v3bxNzRE37rw9dv/kCgYEAnhXyUlcDdMTK2HvWPU1c\nPovX36aK9cHKoBeS7G2vypwezEsTGbA8kXghQApoKXvsnvg+rD3F93ujtHpkLeNH\nOUWmbe8e9RGAqlZ58sEfCCIvpRe5Q4ir5igyc6cpEH2i0sO4np2wejUbwnVHDcML\nCqB9uAWzB/gICp2g/5G6Cu8=\n-----END PRIVATE KEY-----\n',
        },
        projectId: googleProjectId
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

    const [operation] = await client.longRunningRecognize(request);

    const [response] = await operation.promise();
    console.log(`response: ${response}`);

    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    console.log(`Transcription: ${transcription}`);

    const projectId = client.getProjectId();
    console.log(projectId);

    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "google-transcription.txt",
        Body: transcription
    };
    await S3PutObject(s3Params);

    // const s3Params = {
    //     Bucket: outputLocation.awsS3Bucket,
    //     Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "audioGoogle.flac",
    //     Body: await fsReadFile(output)
    // };
    // await S3PutObject(s3Params);

    console.log("##################");
    console.log("Speech to Text END");
    console.log("##################");


    // 9. updating JobAssignment with jobOutput
    Logger.debug("61.8. Associate output location with job output");
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();

    Logger.debug("#######################");
    Logger.debug("extract-audio.js - END ");
    Logger.debug("#######################");

}

extractAudio.profileName = "ExtractAudio";

module.exports = {
    extractAudio
};