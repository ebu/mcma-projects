//"use strict";
const fs = require("fs");
const util = require("util");
const uuidv4 = require("uuid/v4");

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

// adding bin folder to process path
process.env["PATH"] = process.env["PATH"] + ":" + process.env["LambdaTaskRoot"] + "/bin";

const AWS = require("aws-sdk");
const S3 = new AWS.S3();

const { Exception } = require("@mcma/core");
const { AwsS3FileLocator } = require("@mcma/aws-s3");

const { mediaInfo } = require("../media-info");

async function extractTechnicalMetadata(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const jobInput = jobAssignmentHelper.getJobInput();

    logger.info("Execute media info on input file");
    let inputFile = jobInput.inputFile;
    let outputLocation = jobInput.outputLocation;

    let output;

    if (inputFile.httpEndpoint) { // in case we receive a Locator with an httpEndpoint we"ll use the mediaInfo option that can analyze while downloading the file directly
        logger.info("obtaining mediainfo output based on url " + inputFile.httpEndpoint);
        output = await mediaInfo(["--Output=EBUCore_JSON", inputFile.httpEndpoint]);

    } else if (inputFile.awsS3Bucket && inputFile.awsS3Key) { // else we have to copy the file to internal storage (max 500mb) and analyze it directly
        logger.info("obtain data from s3 object Bucket: " + inputFile.awsS3Bucket + " and Key: " + inputFile.awsS3Key);
        let data = await S3.getObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key }).promise();

        logger.info("write data to local tmp storage");
        let localFilename = "/tmp/" + uuidv4();
        await fsWriteFile(localFilename, data.Body);

        logger.info("obtain mediainfo output");
        output = await mediaInfo(["--Output=EBUCore_JSON", localFilename]);

        logger.info("removing local file");
        await fsUnlink(localFilename);
    } else {
        throw new Exception("Not able to obtain input file");
    }

    logger.info("check if we have mediaInfo output");
    if (!output || !output.stdout) {
        throw new Exception("Failed to obtain mediaInfo output");
    }

    logger.info("Writing mediaInfo output to output location");
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
        Body: output.stdout
    };

    await S3.putObject(s3Params).promise();

    jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await jobAssignmentHelper.complete();
}

module.exports = {
    extractTechnicalMetadata
};
