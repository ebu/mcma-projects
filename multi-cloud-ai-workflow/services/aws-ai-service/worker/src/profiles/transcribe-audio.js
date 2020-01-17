const AWS = require("aws-sdk");

const S3 = new AWS.S3();

const TranscribeService = new AWS.TranscribeService();

const { Exception } = require("@mcma/core");
const { ProcessJobAssignmentHelper } = require("@mcma/worker");
const { AwsS3FileLocator } = require("@mcma/aws-s3");

async function transcribeAudio(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const inputFile = jobAssignmentHelper.getJobInput().inputFile;
    const jobAssignmentId = jobAssignmentHelper.getJobAssignmentId();

    logger.debug("2. Speech to text transcription service");

    logger.debug("2.1 Obtain input media file URL");
    let mediaFileUrl;
    if (inputFile.httpEndpoint) {
        mediaFileUrl = inputFile.httpEndpoint;
    } else {
        const data = await S3.getBucketLocation({ Bucket: inputFile.awsS3Bucket }).promise();
        logger.debug(data);
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        mediaFileUrl = "https://" + s3SubDomain + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
    }

    logger.debug("2.2 identify media format");
    let mediaFormat;
    if (mediaFileUrl.toLowerCase().endsWith("mp3")) {
        mediaFormat = "mp3";
    } else if (mediaFileUrl.toLowerCase().endsWith("mp4")) {
        mediaFormat = "mp4";
    } else if (mediaFileUrl.toLowerCase().endsWith("wav")) {
        mediaFormat = "wav";
    } else if (mediaFileUrl.toLowerCase().endsWith("flac")) {
        mediaFormat = "flac";
    } else {
        throw new Exception("Unable to determine Media Format from input file '" + mediaFileUrl + "'");
    }

    logger.debug("2.3 initialise and call transcription service");
    const params = {
        TranscriptionJobName: "TranscriptionJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
        LanguageCode: "en-US",
        Media: {
            MediaFileUri: mediaFileUrl
        },
        MediaFormat: mediaFormat,
        OutputBucketName: jobAssignmentHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket")
    };

    logger.debug("2.4 call speech to text service");
    const data = await TranscribeService.startTranscriptionJob(params).promise();

    logger.debug("2.5 visualise service results with path to STT results in service local repository");
    logger.info(JSON.stringify(data, null, 2));

    logger.debug("2.6. TranscriptionJobName used in s3-trigger");
    logger.debug("See regex for transcriptionJob in aws-ai-service/se-trigger/src/index.js");
    logger.debug(params.TranscriptionJobName);
}

async function processTranscribeJobResult(providers, workerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        providers.getDbTableProvider().get(workerRequest.tableName()),
        providers.getResourceManagerProvider().get(workerRequest),
        providers.getLoggerProvider().get(workerRequest.tracker),
        workerRequest);

    const logger = jobAssignmentHelper.getLogger();

    try {
        await jobAssignmentHelper.initialize();

        logger.debug("2.7. Retrieve job inputParameters");
        let jobInput = jobAssignmentHelper.getJobInput();

        logger.debug("2.8. Copy transcribe output file to output location");
        let copySource = encodeURI(workerRequest.input.outputFile.awsS3Bucket + "/" + workerRequest.input.outputFile.awsS3Key);
        let s3Bucket = jobInput.outputLocation.awsS3Bucket;
        let s3Key = (jobInput.outputLocation.awsS3KeyPrefix ? jobInput.outputLocation.awsS3KeyPrefix : "") + workerRequest.input.outputFile.awsS3Key;
        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new Exception("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.debug("2.9. updating JobAssignment with jobOutput");
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

    logger.debug("2.10. Cleanup: Deleting original output file from service");
    try {
        await S3.deleteObject({
            Bucket: workerRequest.input.outputFile.awsS3Bucket,
            Key: workerRequest.input.outputFile.awsS3Key,
        }).promise();
    } catch (error) {
        console.warn("Failed to cleanup transcribe output file");
    }
}

module.exports = {
    transcribeAudio,
    processTranscribeJobResult
};
