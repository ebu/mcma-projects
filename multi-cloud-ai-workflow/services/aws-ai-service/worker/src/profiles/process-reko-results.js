const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const Rekognition = new AWS.Rekognition();

const { ProcessJobAssignmentHelper } = require("@mcma/worker");
const { AwsS3FileLocator } = require("@mcma/aws-s3");

async function processRekognitionResult(providers, workerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        providers.getDbTableProvider().get(workerRequest.tableName()),
        providers.getResourceManagerProvider().get(workerRequest),
        providers.getLoggerProvider().get(workerRequest.tracker),
        workerRequest
    );

    const logger = jobAssignmentHelper.getLogger();

    try {
        await jobAssignmentHelper.initialize();

        // 2. Retrieve job inputParameters
        const jobInput = jobAssignmentHelper.getJobInput();

        const rekoJobId = workerRequest.input.jobInfo.rekoJobId;
        const rekoJobType = workerRequest.input.jobInfo.rekoJobType;
        const status = workerRequest.input.jobInfo.status;

        if (status !== "SUCCEEDED") {
            throw new Exception("AI Rekognition failed job info: rekognition status:" + status);
        }

        // 3. Get the result from the Rekognition service
        let data = [];
        let dataCelebrity = [];
        let dataFace = [];
        let dataNextToken;
        switch (rekoJobType) {
            case "StartCelebrityRecognition":
                dataCelebrity = await Rekognition.getCelebrityRecognition({
                    JobId: rekoJobId,
                    SortBy: "TIMESTAMP"
                }).promise();
                data = data.concat(dataCelebrity.Celebrities);
                let count = 0;
                while (dataCelebrity["Celebrities"].length === 1000) {
                    dataNextToken = dataCelebrity["NextToken"];
                    dataCelebrity = await Rekognition.getCelebrityRecognition({
                        JobId: rekoJobId,
                        SortBy: "TIMESTAMP",
                        NextToken: dataNextToken
                    }).promise();
                    if (count < 1) {
                        data = data.concat(dataCelebrity.Celebrities);
                        count++;
                    }
                }
                break;
            case "StartFaceDetection":
                dataFace = await Rekognition.getFaceDetection({
                    JobId: rekoJobId,
                }).promise();
                data = data.concat(dataFace.Faces);
                let count2 = 0;
                while (dataFace["Faces"].length === 1000) {
                    dataNextToken = dataFace["NextToken"];
                    dataFace = await Rekognition.getFaceDetection({
                        JobId: rekoJobId,
                        NextToken: dataNextToken
                    }).promise();
                    if (count2 < 1) {
                        data = data.concat(dataFace.Faces);
                        count2++;
                    }
                }
                break;
            case "StartLabelDetection":
            case "StartContentModeration":
            case "StartPersonTracking":
            case "StartFaceSearch":
                throw new Exception(rekoJobType + " : Not implemented");
            default:
                throw new Exception("Unknown rekoJobType");
        }

        if (!data) {
            throw new Exception("No data was returned by AWS Rekogntion");
        }

        // Logger.debug("data returned by Rekognition", JSON.stringify(data, null, 2));

        // AWS Reko may create empty json element - remove them
        walkclean(data);

        // 3. write Reko output file to output location
        const s3Bucket = jobInput.outputLocation.awsS3Bucket;

        let videoFileName = jobInput.inputFile.awsS3Key;
        videoFileName = videoFileName.replace(".mp4", "").replace("media/", "");
        const newS3Key = "reko_" + "media_" + videoFileName + "_" + rekoJobType + "_" + uuidv4() + ".json";

        const s3Params = {
            Bucket: s3Bucket,
            Key: newS3Key,
            Body: JSON.stringify(data)
        };

        try {
            await S3.putObject(s3Params).promise();
        } catch (error) {
            throw new Exception("Unable to write output file to bucket '" + s3Bucket + "' with key '" + newS3Key + "' due to error: " + error.message);
        }

        logger.debug("Wrote Reko result file to S3 bucket : " + s3Bucket + " S3 key : " + newS3Key);

        jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
            awsS3Bucket: s3Bucket,
            awsS3Key: newS3Key
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
}

function walkclean(x) {
    let type = typeof x;
    if (x instanceof Array) {
        type = "array";
    }
    if ((type === "array") || (type === "object")) {
        for (let k in x) {
            if (x.hasOwnProperty(k)) {
                const v = x[k];
                if ((v === "") && (type === "object")) {
                    delete x[k];
                } else {
                    walkclean(v);
                }
            }
        }
    }
}

module.exports = {
    processRekognitionResult
};
