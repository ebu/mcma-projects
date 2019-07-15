const util = require("util");
const AWS = require("aws-sdk");

const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));

const Polly = new AWS.Polly();
const PollyStartSpeechSynthesisTask = util.promisify(Polly.startSpeechSynthesisTask.bind(Polly));

const { Logger, JobAssignment, Locator, AIJob } = require("mcma-core");
const { WorkerJobHelper } = require("mcma-worker");
const { DynamoDbTableProvider, getAwsV4ResourceManager } = require("mcma-aws");


async function textToSpeech(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const inputFile = jobInput.inputFile;
    const jobAssignmentId = workerJobHelper.getJobAssignmentId();

    const params = {
        OutputFormat: 'mp3',
        OutputS3BucketName: workerJobHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket"),
        OutputS3KeyPrefix: 'TextToSpeechJob-' + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
        Text: 'This is a MCMA test',
        VoiceId: 'Joanna',
        LanguageCode: 'en-US',
        SampleRate: '22050',
        TextType: 'text'
    }

    const data = await PollyStartSpeechSynthesisTask(params);

    console.log(JSON.stringify(data, null, 2));
}

const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const processTextToSpeechJobResult = async (request) => {
    const workerJobHelper = new WorkerJobHelper(
        AIJob,
        dynamoDbTableProvider.table(request.tableName()),
        getAwsV4ResourceManager(request),
        request,
        request.input.jobAssignmentId
    );
    
    let jobAssignmentId = request.input.jobAssignmentId;

    try {
        await workerJobHelper.initialize();

        // 2. Retrieve job inputParameters
        let jobInput = workerJobHelper.getJobInput();

        // 3. Copy textToSpeech output file to output location
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
}

textToSpeech.profileName = "AWSTextToSpeech";

module.exports = {
    textToSpeech,
    processTextToSpeechJobResult
};