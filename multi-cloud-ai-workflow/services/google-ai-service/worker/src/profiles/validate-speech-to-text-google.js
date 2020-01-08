const util = require("util");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const RpcClient = require("node-json-rpc2").Client;

const { Exception } = require("@mcma/core");
const { AwsS3FileLocator } = require("@mcma/aws-s3");

async function validateSpeechToTextGoogle(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const jobInput = jobAssignmentHelper.getJobInput();
    const hypothesis = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    logger.debug("#################################");
    logger.debug("validate-speech-to-text-google.js");
    logger.debug("#################################");

    logger.debug("41. STT benchmarking evaluating the quality of the speech to text service");

    logger.debug("41.1 get STT output file -> hypothesis from job creation parameters");
    // the content to be tested is called "hypothesis" in respect to the terminology used in STT benchmarking
    const s3Bucket_hypothesis = hypothesis.awsS3Bucket;
    const s3Key_hypothesis = hypothesis.awsS3Key;
    let s3Object_hypothesis;
    try {
        s3Object_hypothesis = await S3.getObject({
            Bucket: s3Bucket_hypothesis,
            Key: s3Key_hypothesis,
        }).promise();
    } catch (error) {
        throw new Exception("Unable to read file in bucket '" + s3Bucket_hypothesis + "' with key '" + s3Key_hypothesis + "' due to error: " + error.message);
    }

    logger.debug("41.2 extract hypothesis text to be evaluated");
    const hypothesisText = s3Object_hypothesis.Body.toString();
    logger.info(hypothesisText);

    logger.debug("41.3 get reference file stored in tempBucket/temp provided from step 41 as input parameter in job call");
    const s3Key_reference = "temp/stt_output_clean.txt";
    let s3Object_reference;
    try {
        s3Object_reference = await S3.getObject({
            Bucket: s3Bucket_hypothesis,
            Key: s3Key_reference,
        }).promise();
    } catch (error) {
        throw new Exception("Unable to read file in bucket '" + s3Bucket_hypothesis + "' with key '" + s3Key_reference + "' due to error: " + error.message);
    }

    logger.debug("41.4 extract reference text against which hypothesisText is to be compared");
    const referenceText = JSON.parse(s3Object_reference.Body.toString());
    logger.info(referenceText.results.transcripts[0].transcript);

    logger.debug("41.4 initialse and call sttbenchmarking service from public url using node-json-rpc2 API");
    // The URL is generated by AWS ECS when initializing the service and task from the sttBenchmarking docker image");
    // Only worddiffs is used for visualisation of the results but other options are available such as the word error rate
    let client = new RpcClient({
        protocol: "http",//Optional. Will be http by default
        host: "52.30.8.180",
        path: "/api",
        port: "8080",
        method: "POST"//Optional. POST by default
    });
    let params = {};
    params.ref = "\"" + referenceText.results.transcripts[0].transcript + "\"";
    params.hyp = "\"" + hypothesisText + "\"";
    params.dialect = "html";
    // worddiffs
    let request_wd = {};
    request_wd.jsonrpc = "2.0";
    request_wd.id = "79idqltpu8";
    request_wd.params = params;
    request_wd.method = "metrics.worddiffs";
    logger.info(request_wd);

    const clientCall = util.promisify(client.call.bind(client));

    logger.debug("41.5 Visualise worddiffs results");
    const result = await clientCall(request_wd);
    logger.info(result);

    logger.debug("41.6 Save worddiffs results to worddiffs.txt file on TempBucket/AIResults");
    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "sttbenchmarking/worddiffs_google.txt",
        Body: JSON.stringify(result)
    };
    await S3.putObject(s3Params).promise();

    logger.debug("41.7 Updating jobAssignment with job output");
    jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });
    await jobAssignmentHelper.complete();
}

module.exports = {
    validateSpeechToTextGoogle
};
