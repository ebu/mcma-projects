const util = require("util");
const AWS = require("aws-sdk");

const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));

const TranscribeService = new AWS.TranscribeService();
const TranscribeServiceStartTranscriptionJob = util.promisify(TranscribeService.startTranscriptionJob.bind(TranscribeService));

const { Logger, Locator, AIJob } = require("@mcma/core");
const { WorkerJobHelper } = require("@mcma/worker");

async function transcribeAudio(workerJobHelper) {
    const inputFile = workerJobHelper.getJobInput().inputFile;
    const jobAssignmentId = workerJobHelper.getJobAssignmentId();

    // obtain media file URL
    let mediaFileUrl;

    if (inputFile.httpEndpoint) {
        mediaFileUrl = inputFile.httpEndpoint;
    } else {
        const data = await S3GetBucketLocation({ Bucket: inputFile.awsS3Bucket });
        Logger.debug(JSON.stringify(data, null, 2));
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        mediaFileUrl = "https://" + s3SubDomain + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
    }
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
        throw new Error("Unable to determine Media Format from input file '" + mediaFileUrl + "'");
    }

    const params = {
        TranscriptionJobName: "TranscriptionJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
        LanguageCode: "en-US",
        Media: {
            MediaFileUri: mediaFileUrl
        },
        MediaFormat: mediaFormat,
        OutputBucketName: workerJobHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket")
    }

    const data = await TranscribeServiceStartTranscriptionJob(params);

    console.log(JSON.stringify(data, null, 2));
}

function processTranscribeJobResult(resourceManagerProvider, dynamoDbTableProvider) {
    return async function processTranscribeJobResult(request) {
        const workerJobHelper = new WorkerJobHelper(
            AIJob,
            dynamoDbTableProvider.table(request.tableName()),
            resourceManagerProvider.get(request),
            request,
            request.input.jobAssignmentId
        );

        try {
            await workerJobHelper.initialize();

            // 2. Retrieve job inputParameters
            let jobInput = workerJobHelper.getJobInput();

            // 3. Copy transcribe output file to output location
            let copySource = encodeURI(request.input.outputFile.awsS3Bucket + "/" + request.input.outputFile.awsS3Key);

            let s3Bucket = jobInput.outputLocation.awsS3Bucket;
            let s3Key = (jobInput.outputLocation.awsS3KeyPrefix ? jobInput.outputLocation.awsS3KeyPrefix : "") + request.input.outputFile.awsS3Key;

            try {
                await S3CopyObject({
                    CopySource: copySource,
                    Bucket: s3Bucket,
                    Key: s3Key,
                });
            } catch (error) {
                throw new Error("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
            }

            // 4. updating JobAssignment with jobOutput
            workerJobHelper.getJobOutput().outputFile = new Locator({
                awsS3Bucket: s3Bucket,
                awsS3Key: s3Key
            });
            
            await workerJobHelper.complete();
        } catch (error) {
            Logger.exception(error);
            try {
                await workerJobHelper.fail(error.message);
            } catch (error) {
                Logger.exception(error);
            }
        }

        // Cleanup: Deleting original output file
        try {
            await S3DeleteObject({
                Bucket: request.input.outputFile.awsS3Bucket,
                Key: request.input.outputFile.awsS3Key,
            });
        } catch (error) {
            console.warn("Failed to cleanup transcribe output file");
        }
    };
}

transcribeAudio.profileName = "AWSTranscribeAudio";

module.exports = {
    transcribeAudio,
    processTranscribeJobResult
};