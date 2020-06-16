import * as AWS from "aws-sdk";
import { AIJob, getTableName, JobAssignment, McmaException } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

const S3 = new AWS.S3();
const Polly = new AWS.Polly();

export async function textToSpeech(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const voiceId = jobInput.voiceId;
    const jobAssignmentId = jobAssignmentHelper.jobAssignmentId;

    logger.debug("12. Generate speech from translation text");

    logger.debug("12.1. get input text file from translation service output");
    // get input text file from translation service
    const s3Bucket = inputFile.awsS3Bucket;
    const s3Key = inputFile.awsS3Key;
    let s3Object;
    try {
        s3Object = await S3.getObject({
            Bucket: s3Bucket,
            Key: s3Key,
        }).promise();
    } catch (error) {
        throw new McmaException("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    logger.debug("12.2. extract text from file");
    const inputText = s3Object.Body.toString();
    logger.debug(inputText);

    logger.debug("12.3. configure and call text to speech service");
    const params = {
        OutputFormat: "mp3",
        OutputS3BucketName: jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("ServiceOutputBucket"),
        OutputS3KeyPrefix: "TextToSpeechJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
        Text: inputText,
        VoiceId: voiceId,
        SampleRate: "22050",
        TextType: "text"
    };
    const data = await Polly.startSpeechSynthesisTask(params).promise();

    logger.debug("12.4. visualise data containing the url of the mp3 generated by the service");
    logger.debug(JSON.stringify(data, null, 2));

    logger.debug("12.5. OutputS3KeyPrefix used in s3-trigger");
    logger.debug("See regex for textToSpeechJob in aws-ai-service/se-trigger/src/index.js");
    logger.debug(params.OutputS3KeyPrefix);
}

export async function processTextToSpeechJobResult(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        providers.dbTableProvider.get(getTableName(workerRequest), JobAssignment),
        providers.resourceManagerProvider.get(workerRequest),
        workerRequest
    );

    const logger = jobAssignmentHelper.logger;

    try {
        await jobAssignmentHelper.initialize();
        logger.debug("12.6. Retrieve job inputParameters");
        let jobInput = jobAssignmentHelper.jobInput;

        logger.debug("12.7. Copy textToSpeech output file to output location");
        let copySource = encodeURI(workerRequest.input.outputFile.awsS3Bucket + "/" + workerRequest.input.outputFile.awsS3Key);
        let outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");
        let s3Bucket = outputLocation.awsS3Bucket;
        // define the output file name of the mp3 file
        let s3Key = (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "translation.mp3";

        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.debug("12.8. updating JobAssignment with jobOutput");
        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key
        }));

        await jobAssignmentHelper.complete();
    } catch (error) {
        logger.error(error.toString());
        try {
            await jobAssignmentHelper.fail(error.message);
        } catch (error) {
            logger.error(error.toString());
        }
    }

    logger.debug("12.10. Cleanup: Deleting original output file from service");
    try {
        await S3.deleteObject({
            Bucket: workerRequest.input.outputFile.awsS3Bucket,
            Key: workerRequest.input.outputFile.awsS3Key,
        }).promise();
    } catch (error) {
        logger.warn("Failed to cleanup transcribe output file");
    }
}