//"use strict";
const util = require("util");
const uuidv4 = require("uuid/v4");

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { Exception } = require("@mcma/core");
const { AwsS3FileLocator } = require("@mcma/aws-s3");
const { ffmpeg } = require("../ffmpeg");

async function createProxyLambda(providers, jobAssignmentHelper) {
    const logger = jobAssignmentHelper.getLogger();

    const jobInput = jobAssignmentHelper.getJobInput();

    // 6. Execute ffmpeg on input file
    // logger.debug("6. Execute ffmpeg on input file");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    let tempFilename;
    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        // 6.1. obtain data from s3 object
        logger.debug(" 6.1. obtain data from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        // 6.2. write data to local tmp storage
        logger.debug("6.2. write data to local tmp storage");
        const localFilename = "/tmp/" + uuidv4();
        await fsWriteFile(localFilename, data.Body);

        // 6.3. obtain ffmpeg output
        logger.debug("6.3. obtain ffmpeg output");
        tempFilename = "/tmp/" + uuidv4() + ".mp4";
        const params = ["-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt", "yuv420p", tempFilename];
        await ffmpeg(params);

        // 6.4. removing local file
        logger.debug("6.4. removing local file");
        await fsUnlink(localFilename);

    } else {
        throw new Exception("Not able to obtain input file");
    }

    // 7. Writing ffmpeg output to output location
    // Logger.debug("7. Writing ffmpeg output to output location");

    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".mp4",
        Body: await fsReadFile(tempFilename)
    };

    await S3PutObject(s3Params);

    // 8. removing temp file
    // Logger.debug("8. removing temp file");
    await fsUnlink(tempFilename);

    // 9. updating JobAssignment with jobOutput
    jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await jobAssignmentHelper.complete();
}

module.exports = {
    createProxyLambda
};
