const AWS = require("aws-sdk");

const S3 = new AWS.S3();

const Polly = new AWS.Polly();

const { Exception } = require("@mcma/core");
const { ProcessJobAssignmentHelper } = require("@mcma/worker");
const { AwsS3FileLocator } = require("@mcma/aws-s3");


// A service to generate text to speech using the SSML language combined with AWS Polly

async function ssmlTextToSpeech(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const jobInput = jobAssignmentHelper.getJobInput();
    const inputFile = jobInput.inputFile;
    const voiceId = jobInput.voiceId;
    const jobAssignmentId = jobAssignmentHelper.getJobAssignmentId();

    logger.debug("16. generate text to speech using SSML and Polly");

    logger.debug("16.1. get input SSML file from tokenized-text-to-speech");
    // get input text file from tokenized ssml service stored in tempBucket AiInput/ssmlTranslation.txt
    const s3Bucket_ssml = inputFile.awsS3Bucket;
    const s3Key_ssml = inputFile.awsS3Key;
    let s3Object_ssml;
    try {
        s3Object_ssml = await S3.getObject({
            Bucket: s3Bucket_ssml,
            Key: s3Key_ssml,
        }).promise();
    } catch (error) {
        throw new Exception("Unable to read file in bucket '" + s3Bucket_ssml + "' with key '" + s3Key_ssml + "' due to error: " + error.message);
    }

    logger.debug("16.2. extract SSML file content");
    const inputText = s3Object_ssml.Body.toString();
    logger.debug(inputText);

    logger.debug("16.3. call text to speech service: Polly with SSML");
    const params_ssml = {
        OutputFormat: "mp3",
        OutputS3BucketName: jobAssignmentHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket"),
        OutputS3KeyPrefix: "ssmlTextToSpeechJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
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
async function processSsmlTextToSpeechJobResult(providers, workerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        providers.getDbTableProvider().get(workerRequest.tableName()),
        providers.getResourceManagerProvider().get(workerRequest),
        providers.getLoggerProvider().get(workerRequest.tracker),
        workerRequest
    );

    const logger = jobAssignmentHelper.getLogger();

    try {
        await jobAssignmentHelper.initialize();

        logger.debug("16.6. Retrieve job inputParameters");
        let jobInput = jobAssignmentHelper.getJobInput();

        logger.debug("16.7. Copy textToSpeech output file to output location defined in Job");
        // request.input.outputFile -> process temporary output file
        let copySource = encodeURI(workerRequest.input.outputFile.awsS3Bucket + "/" + workerRequest.input.outputFile.awsS3Key);
        logger.info(copySource);

        let s3Bucket = jobInput.outputLocation.awsS3Bucket;
        let s3Key = (jobInput.outputLocation.awsS3KeyPrefix ? jobInput.outputLocation.awsS3KeyPrefix : "") + "ssmlTranslationToSpeech.mp3";

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
        jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: s3Key
        });
        await jobAssignmentHelper.complete();


    } catch (error) {
        logger.error(error.toString());
        try {
            await jobAssignmentHelper.fail(error.message);
        } catch (error) {
            logger.error(error.toString());
        }
    }

    // Cleanup: Deleting original output file
    try {
        await S3.deleteObject({
            Bucket: workerRequest.input.outputFile.awsS3Bucket,
            Key: workerRequest.input.outputFile.awsS3Key,
        }).promise();
    } catch (error) {
        logger.warn("Failed to cleanup transcribe output file");
    }
}

module.exports = {
    ssmlTextToSpeech,
    processSsmlTextToSpeechJobResult
};
