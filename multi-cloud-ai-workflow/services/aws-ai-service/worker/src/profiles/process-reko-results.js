
const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const Rekognition = new AWS.Rekognition();
const RekognitionGetCelebrityRecognition = util.promisify(Rekognition.getCelebrityRecognition.bind(Rekognition));
const RekognitionGetFaceDetection = util.promisify(Rekognition.getFaceDetection.bind(Rekognition));

const { Logger, Locator, JobAssignment, AIJob } = require("mcma-core");
const { WorkerJobHelper } = require("mcma-worker");
const { DynamoDbTableProvider, getAwsV4ResourceManager } = require("mcma-aws");

const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const processRekognitionResult = async (request) => {
    const workerJobHelper = new WorkerJobHelper(
        AIJob,
        dynamoDbTableProvider.table(request.tableName()),
        getAwsV4ResourceManager(request),
        request,
        request.input.jobAssignmentId
    );

    try {
        await workerJobHelper.initialize();

        // 2. Retrieve job inputParameters
        let jobInput = workerJobHelper.getJobInput();

        let s3Bucket = jobInput.outputLocation.awsS3Bucket;

        let rekoJobId = request.input.jobInfo.rekoJobId;
        let rekoJobType = request.input.jobInfo.rekoJobType;
        let status = request.input.jobInfo.status;

        if (status != "SUCCEEDED") {
            throw new Error("AI Rekognition failed job info: rekognition status:" + status);
        }

        // 3. Get the result from the Rekognition service 
        let data;

        switch (rekoJobType) {
            case "StartCelebrityRecognition":
                // TODO implement iteration over next results in case we have more than 1000 results
                data = await RekognitionGetCelebrityRecognition({
                    JobId: rekoJobId,
                    SortBy: "TIMESTAMP"
                });
                break;
            case "StartFaceDetection":
                // TODO implement iteration over next results in case we have more than 1000 results
                data = await RekognitionGetFaceDetection({
                    JobId: rekoJobId
                });
                break;
            case "StartLabelDetection":
            case "StartContentModeration":
            case "StartPersonTracking":
            case "StartFaceSearch":
                throw new Error(rekoJobType + " : Not implemented");
            default:
                throw new Error("Unknown rekoJobType");
        }


        if (!data) {
            throw new Error("No data was returned by AWS Rekogntion");
        }

        Logger.debug("data returned by Rekognition", JSON.stringify(data, null, 2));

        // AWS Reko may create empty json element - remove them
        walkclean(data);

        // 3. write Reko output file to output location
        const newS3Key = "reko_" + uuidv4() + ".json";
        const s3Params = {
            Bucket: s3Bucket,
            Key: newS3Key,
            Body: JSON.stringify(data)
        };

        try {
            await S3PutObject(s3Params);
        } catch (error) {
            throw new Error("Unable to write output file to bucket '" + s3Bucket + "' with key '" + newS3Key + "' due to error: " + error.message);
        }

        Logger.debug("Wrote Reko result file to S3 bucket : " + s3Bucket + " S3 key : " + newS3Key);

        workerJobHelper.getJobOutput().outputFile = new Locator({
            awsS3Bucket: s3Bucket,
            awsS3Key: newS3Key
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
};

function walkclean(x) {
    var type = typeof x;
    if (x instanceof Array) {
        type = "array";
    }
    if ((type == "array") || (type == "object")) {
        for (let k in x) {
            var v = x[k];
            if ((v === "") && (type == "object")) {
                delete x[k];
            } else {
                walkclean(v);
            }
        }
    }
}

module.exports = {
    processRekognitionResult
};
