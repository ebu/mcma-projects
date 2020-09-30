import * as util from "util";
import * as fs from "fs";

import * as AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

import { Storage } from "@google-cloud/storage";
import speech from "@google-cloud/speech";

import { AIJob, EnvironmentVariableProvider, McmaException } from "@mcma/core";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";
import { google } from "@google-cloud/speech/build/protos/protos";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";

const RecognitionConfig = google.cloud.speech.v1.RecognitionConfig;
const RecognitionAudio = google.cloud.speech.v1p1beta1.RecognitionAudio;
const AudioEncoding = google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);
const S3 = new AWS.S3();

const environmentVariables = new EnvironmentVariableProvider();

async function getGoogleServiceCredentials(): Promise<any> {
    try {
        const googleServiceCredentialsS3Bucket = environmentVariables.getRequiredContextVariable<string>("GoogleServiceCredentialsS3Bucket");
        const googleServiceCredentialsS3Key = environmentVariables.getRequiredContextVariable<string>("GoogleServiceCredentialsS3Key");

        const data = await S3.getObject({
            Bucket: googleServiceCredentialsS3Bucket,
            Key: googleServiceCredentialsS3Key,
        }).promise();

        return JSON.parse(data.Body.toString());
    } catch (error) {
        throw new McmaException("Failed to obtain Google Service Credentials", error);
    }
}

export async function speechToText(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;

    logger.info("Initialization of Google credentials");
    const googleCredentials = await getGoogleServiceCredentials();

    const googleProjectId = googleCredentials.project_id;
    const googleClientEmail = googleCredentials.client_email;
    const googlePrivateKey = googleCredentials.private_key;

    logger.info("Project Id: " + googleProjectId);
    logger.info("Client Email: " + googleClientEmail);
    logger.info("Private Key Id: " + googleCredentials.private_key_id);

    const googleBucketName = environmentVariables.getRequiredContextVariable<string>("GoogleBucketName");
    logger.info("Using google bucket with name: " + googleBucketName);

    const jobInput = jobAssignmentHelper.jobInput;
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    if (!inputFile.bucket || !inputFile.key) {
        throw new McmaException("Failed to find bucket and/or key properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }

    const storage = new Storage({
        credentials: {
            client_email: googleClientEmail,
            private_key: googlePrivateKey,
        },
        projectId: googleProjectId
    });

    let bucketExists = false;
    const [buckets] = await storage.getBuckets();
    logger.info(buckets);

    for (let bucket of buckets) {
        if (bucket["id"] === googleBucketName) {
            bucketExists = true;
        }
    }

    if (!bucketExists) {
        await storage.createBucket(googleBucketName, {
            location: "eu",
            standard: true
        });
        logger.info("Bucket " + googleBucketName + " created.");
    } else {
        logger.info("Bucket " + googleBucketName + " already exists.");
    }

    logger.info("Obtain data from s3 object Bucket: " + inputFile.bucket + " and Key: " + inputFile.key);
    const data = await S3.getObject({
        Bucket: inputFile.bucket,
        Key: inputFile.key,
    }).promise();

    const fileExtension = inputFile.key.substring(inputFile.key.lastIndexOf(".") + 1);
    const tempFileName = uuidv4() + "." + fileExtension;

    logger.info("Write file to local tmp storage");
    const localFilename = "/tmp/" + tempFileName;
    await fsWriteFile(localFilename, data.Body);

    try {
        const result = await storage.bucket(googleBucketName).upload(localFilename, {
            resumable: false,
            metadata: {
                cacheControl: "public, max-age=31536000",
            },
        });
        logger.info("Uploaded audio file to google bucket");
        logger.info(result);

        const client = new speech.SpeechClient({
            credentials: {
                client_email: googleClientEmail,
                private_key: googlePrivateKey,
            },
            projectId: googleProjectId
        });

        const gcsUri = "gs://" + googleBucketName + "/" + tempFileName;
        const encoding = AudioEncoding.FLAC;
        const sampleRateHertz = 48000;
        const languageCode = "en-US";
        const audioChannelCount = 2;

        const config = new RecognitionConfig({
            encoding: encoding,
            sampleRateHertz: sampleRateHertz,
            audioChannelCount: audioChannelCount,
            languageCode: languageCode,
            enableAutomaticPunctuation: true,
        });

        const audio = new RecognitionAudio({
            uri: gcsUri,
        });

        const request = {
            config: config,
            audio: audio,
        };

        const [operation] = await client.longRunningRecognize(request);

        const [response] = await operation.promise();
        logger.info("Response:");
        logger.info(response);

        const transcription = response.results
                                      .map(result => result.alternatives[0].transcript)
                                      .join("\n");
        logger.info("Transcription: " + transcription);

        const projectId = client.getProjectId();
        logger.info(projectId);

        let s3Params = {
            Bucket: outputLocation.bucket,
            Key: (outputLocation.keyPrefix ?? "") + uuidv4() + ".txt",
            Body: transcription
        };
        await S3.putObject(s3Params).promise();

        logger.info("Updating job assignment with output");
        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            bucket: s3Params.Bucket,
            key: s3Params.Key
        }));

        await jobAssignmentHelper.complete();
    } finally {
        try {
            logger.info("Removing file from Google Bucket " + googleBucketName);
            await storage.bucket(googleBucketName).file(tempFileName).delete();
        } catch (error) {
            logger.error("Failed to delete file in Google Bucket " + googleBucketName);
            logger.error(error);
        }
        await fsUnlink(localFilename);
    }
}
