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

const { Logger, Locator } = require("@mcma/core");
const { ffmpeg } = require("../ffmpeg");

function createProxyLambda(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();

    // 6. Execute ffmepg on input file
    // Logger.debug("6. Execute ffmepg on input file");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    let tempFilename;
    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        // 6.1. obtain data from s3 object
        Logger.debug(" 6.1. obtain data from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        // 6.2. write data to local tmp storage
        Logger.debug("6.2. write data to local tmp storage");
        const localFilename = "/tmp/" + uuidv4();
        await fsWriteFile(localFilename, data.Body);

        // 6.3. obtain ffmpeg output
        Logger.debug("6.3. obtain ffmpeg output");
        tempFilename = "/tmp/" + uuidv4() + ".mp4";
        const params = ["-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt", "yuv420p", tempFilename];
        await ffmpeg(params);

        // 6.4. removing local file
        Logger.debug("6.4. removing local file");
        await fsUnlink(localFilename);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    // Logger.debug("7. Writing ffmepg output to output location");

    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".mp4",
        Body: await fsReadFile(tempFilename)
    }

    await S3PutObject(s3Params);

    // 8. removing temp file
    // Logger.debug("8. removing temp file");
    await fsUnlink(tempFilename);

    // 9. updating JobAssignment with jobOutput
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();
}

module.exports = {
    createProxyLambda
};