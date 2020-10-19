import * as AWS from "aws-sdk";
import { AIJob, EnvironmentVariables, McmaException, ProblemDetail } from "@mcma/core";
import { getTableName } from "@mcma/data";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

const S3 = new AWS.S3();
const Polly = new AWS.Polly();
const environmentVariables = EnvironmentVariables.getInstance();

// A service to generate text to speech using the SSML language combined with AWS Polly

export async function ssmlTextToSpeech(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const voiceId = jobInput.voiceId;
    const jobAssignmentDatabaseId = jobAssignmentHelper.jobAssignmentDatabaseId;

    logger.debug("16. generate text to speech using SSML and Polly");

    logger.debug("16.1. get input SSML file from tokenized-text-to-speech");
    // get input text file from tokenized ssml service stored in tempBucket AiInput/ssmlTranslation.txt
    const s3Bucket_ssml = inputFile.bucket;
    const s3Key_ssml = inputFile.key;
    let s3Object_ssml;
    try {
        s3Object_ssml = await S3.getObject({
            Bucket: s3Bucket_ssml,
            Key: s3Key_ssml,
        }).promise();
    } catch (error) {
        throw new McmaException("Unable to read file in bucket '" + s3Bucket_ssml + "' with key '" + s3Key_ssml + "' due to error: " + error.message);
    }

    logger.debug("16.2. extract SSML file content");
    const inputText = s3Object_ssml.Body.toString();
    logger.debug(inputText);

    logger.debug("16.3. call text to speech service: Polly with SSML");
    const params_ssml = {
        OutputFormat: "mp3",
        OutputS3BucketName: environmentVariables.get("ServiceOutputBucket"),
        OutputS3KeyPrefix: "ssmlTextToSpeechJob-" + jobAssignmentDatabaseId.substring(jobAssignmentDatabaseId.lastIndexOf("/") + 1),
        Text: inputText,
        VoiceId: voiceId,
        TextType: "ssml"
    };
    const data = await Polly.startSpeechSynthesisTask(params_ssml).promise();
    logger.debug("16.4. job result with output mp3 url provided by the the AWS service");
    logger.debug(" -> see request.input.outputFile in processSsmlTextToSpeechJobresult");
    logger.debug("out:" + JSON.stringify(data, null, 2));

    logger.debug("16.5. OutputS3KeyPrefix used in s3-trigger");
    logger.debug("See regex for ssmltextToSpeechJob in aws-ai-service/se-trigger/src/index.js");
    logger.debug(params_ssml.OutputS3KeyPrefix);
}

// Process result after s3-trigger
export async function processSsmlTextToSpeechJobResult(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        await providers.dbTableProvider.get(getTableName(environmentVariables)),
        providers.resourceManagerProvider.get(environmentVariables),
        workerRequest
    );

    const logger = jobAssignmentHelper.logger;

    try {
        await jobAssignmentHelper.initialize();

        logger.debug("16.6. Retrieve job inputParameters");
        let jobInput = jobAssignmentHelper.jobInput;

        logger.debug("16.7. Copy textToSpeech output file to output location defined in Job");
        // request.input.outputFile -> process temporary output file
        let copySource = encodeURI(workerRequest.input.outputFile.bucket + "/" + workerRequest.input.outputFile.key);
        logger.info(copySource);

        let outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");
        let s3Bucket = outputLocation.bucket;
        let s3Key = (outputLocation.keyPrefix ? outputLocation.keyPrefix : "") + "ssmlTranslationToSpeech.mp3";

        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Error("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.debug("16.8. updating jobAssignment with jobOutput");
        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            bucket: s3Bucket,
            key: s3Key
        }));
        await jobAssignmentHelper.complete();


    } catch (error) {
        logger.error(error.toString());
        try {
            await jobAssignmentHelper.fail(new ProblemDetail({
                type: "uri://mcma.ebu.ch/rfc7807/aws-ai-service/generic-failure",
                title: "Generic failure",
                detail: error.message
            }));
        } catch (error) {
            logger.error(error.toString());
        }
    }

    // Cleanup: Deleting original output file
    try {
        await S3.deleteObject({
            Bucket: workerRequest.input.outputFile.bucket,
            Key: workerRequest.input.outputFile.key,
        }).promise();
    } catch (error) {
        logger.warn("Failed to cleanup transcribe output file");
    }
}
