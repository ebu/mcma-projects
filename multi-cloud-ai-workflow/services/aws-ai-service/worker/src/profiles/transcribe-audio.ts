import * as AWS from "aws-sdk";
import { McmaException, AIJob, JobAssignment, getTableName, JobParameterBag } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties, getS3Url } from "@mcma/aws-s3";

const S3 = new AWS.S3();
const TranscribeService = new AWS.TranscribeService();

export async function transcribeAudio(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const jobAssignmentId = jobAssignmentHelper.jobAssignmentId;

    logger.debug("2. Speech to text transcription service");

    logger.debug("2.1 Obtain input media file URL");
    let mediaFileUrl: string = await getS3Url(inputFile, S3);

    logger.debug("2.2 identify media format");
    let mediaFormat: string;
    if (mediaFileUrl.toLowerCase().endsWith("mp3")) {
        mediaFormat = "mp3";
    } else if (mediaFileUrl.toLowerCase().endsWith("mp4")) {
        mediaFormat = "mp4";
    } else if (mediaFileUrl.toLowerCase().endsWith("wav")) {
        mediaFormat = "wav";
    } else if (mediaFileUrl.toLowerCase().endsWith("flac")) {
        mediaFormat = "flac";
    } else {
        throw new McmaException("Unable to determine Media Format from input file '" + mediaFileUrl + "'");
    }

    logger.debug("2.3 initialise and call transcription service");
    const params = {
        TranscriptionJobName: "TranscriptionJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
        LanguageCode: "en-US",
        Media: {
            MediaFileUri: mediaFileUrl
        },
        MediaFormat: mediaFormat,
        OutputBucketName: jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("ServiceOutputBucket")
    };

    logger.debug("2.4 call speech to text service");
    const data = await TranscribeService.startTranscriptionJob(params).promise();

    logger.debug("2.5 visualise service results with path to STT results in service local repository");
    logger.info(JSON.stringify(data, null, 2));

    logger.debug("2.6. TranscriptionJobName used in s3-trigger");
    logger.debug("See regex for transcriptionJob in aws-ai-service/se-trigger/src/index.js");
    logger.debug(params.TranscriptionJobName);
}

export async function processTranscribeJobResult(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        providers.dbTableProvider.get(getTableName(workerRequest), JobAssignment),
        providers.resourceManagerProvider.get(workerRequest),
        providers.loggerProvider.get(workerRequest.tracker),
        workerRequest);

    const logger = jobAssignmentHelper.logger;

    try {
        await jobAssignmentHelper.initialize();

        logger.debug("2.7. Retrieve job inputParameters");
        let jobInput = jobAssignmentHelper.jobInput;

        logger.debug("2.8. Copy transcribe output file to output location");
        let copySource = encodeURI(workerRequest.input.outputFile.awsS3Bucket + "/" + workerRequest.input.outputFile.awsS3Key);
        let s3Bucket = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation").awsS3Bucket;
        let s3Key = (jobInput.get<AwsS3FolderLocatorProperties>("outputLocation").awsS3KeyPrefix ? jobInput.get<AwsS3FolderLocatorProperties>("outputLocation").awsS3KeyPrefix : "") + workerRequest.input.outputFile.awsS3Key;
        try {
            await S3.copyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            }).promise();
        } catch (error) {
            throw new McmaException("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        logger.debug("2.9. updating JobAssignment with jobOutput");
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