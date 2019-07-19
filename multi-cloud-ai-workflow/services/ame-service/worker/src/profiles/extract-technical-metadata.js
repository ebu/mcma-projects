//"use strict";

const fs = require("fs");
const util = require("util");
const uuidv4 = require("uuid/v4");

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

// adding bin folder to process path
process.env.PATH = process.env.PATH + ":" + process.env.LambdaTaskRoot + "/bin";

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { Locator } = require("@mcma/core");
const { mediaInfo } = require("../media-info");

async function extractTechnicalMetadata(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();

    // 6. Execute media info on input file
    let inputFile = jobInput.inputFile;
    let outputLocation = jobInput.outputLocation;

    let output;

    if (inputFile.httpEndpoint) { // in case we receive a Locator with an httpEndpoint we"ll use the mediaInfo option that can analyze while downloading the file directly
        // obtain mediainfo output
        output = await mediaInfo(["--Output=EBUCore_JSON", inputFile.httpEndpoint]);

    } else if (inputFile.awsS3Bucket && inputFile.awsS3Key) { // else we have to copy the file to internal storage (max 500mb) and analyze it directly
        // obtain data from s3 object
        let data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        // write data to local tmp storage
        let localFilename = "/tmp/" + uuidv4();
        await fsWriteFile(localFilename, data.Body);

        // obtain mediainfo output
        output = await mediaInfo(["--Output=EBUCore_JSON", localFilename]);

        // removing local file
        await fsUnlink(localFilename);
    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. check if we have mediaInfo output
    if (!output || !output.stdout) {
        throw new Error("Failed to obtain mediaInfo output");
    }

    // 8. Writing mediaInfo output to output location
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
        Body: output.stdout
    };

    await S3PutObject(s3Params);

    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();
}

module.exports = { 
    extractTechnicalMetadata
};