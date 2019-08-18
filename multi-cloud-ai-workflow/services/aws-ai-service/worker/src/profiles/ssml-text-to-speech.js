const util = require("util");
const AWS = require("aws-sdk");

const uuidv4 = require("uuid/v4");

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const { ffmpeg } = require("../ffmpeg");

const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Polly = new AWS.Polly();
const PollyStartSpeechSynthesisTask = util.promisify(Polly.startSpeechSynthesisTask.bind(Polly));
const SynthesizeSpeech = util.promisify(Polly.synthesizeSpeech.bind(Polly));


const { Logger, JobAssignment, Locator, AIJob } = require("mcma-core");
const { WorkerJobHelper } = require("mcma-worker");
const { DynamoDbTableProvider, getAwsV4ResourceManager } = require("mcma-aws");


async function ssmlTextToSpeech(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();
    const inputFile = jobInput.inputFile;
    const voiceId = jobInput.voiceId;
    const jobAssignmentId = workerJobHelper.getJobAssignmentId();

    // get input text file from tokenized ssml service stored in tempBucket AiInput/ssmlTranslation.txt
    const s3Bucket_ssml = inputFile.awsS3Bucket;
    const s3Key_ssml = inputFile.awsS3Key;
    let s3Object_ssml;
    try {
        s3Object_ssml = await S3GetObject({
            Bucket: s3Bucket_ssml,
            Key: s3Key_ssml,
        });
    } catch (error) {
        throw new Error("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
    }

    // extract SSML file content
    const inputText = s3Object_ssml.Body.toString();
    console.log(inputText);

    const params_ssml = {
//            Engine: 'neural',
//            Region: 'eu-west-1',
//            Endpoint-url: "https://polly.eu-west-1.amazonaws.com/"
            OutputFormat: 'mp3',
            OutputS3BucketName: workerJobHelper.getRequest().getRequiredContextVariable("ServiceOutputBucket"),
            OutputS3KeyPrefix:'ssmlTextToSpeechJob-' + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
            Text: inputText,
            VoiceId: voiceId,
            TextType: 'ssml'
//            SampleRate: '22050',
//            TextType: 'text'
        }

    const data = await PollyStartSpeechSynthesisTask(params_ssml);
    console.log("out:" + JSON.stringify(data, null, 2));
    console.log(params_ssml.OutputS3KeyPrefix);
}

const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const processSsmlTextToSpeechJobResult = async (request) => {
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

        console.log(copySource);

        let s3Bucket = jobInput.outputLocation.awsS3Bucket;
        let s3Key = (jobInput.outputLocation.awsS3KeyPrefix ? jobInput.outputLocation.awsS3KeyPrefix : "") + "ssmlTranslationToSpeech.mp3";

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

ssmlTextToSpeech.profileName = "AWSSsmlTextToSpeech";

module.exports = {
    ssmlTextToSpeech,
    processSsmlTextToSpeechJobResult
};