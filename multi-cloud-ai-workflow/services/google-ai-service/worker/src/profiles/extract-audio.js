const util = require("util");
const uuidv4 = require("uuid/v4");

const fs = require("fs");
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { Logger, Locator } = require("mcma-core");
const { ffmpeg } = require("../ffmpeg");



async function extractAudio(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();

    Logger.debug("61. Extract audio track from mp4 source using ffmpeg");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        Logger.debug("61.1. obtain content from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        Logger.debug("61.2. write copy of proxy input file to local ffmpeg tmp storage");
        // the tmp directory is local to the ffmpeg running instance
        const input = "/tmp/" + "proxy_google.mp4";
        await fsWriteFile(input, data.Body);

        Logger.debug("61.3. declare ffmpeg outputs");
        output = "/tmp/" + "extractedAudio.flac";

        Logger.debug("61.4. extract audio track");
        // ffmpeg -i input_video.mp4 -vn output_audio.mp3
        const params_extract_audio = ["-i", input, output];
        console.log(params_extract_audio);
        await ffmpeg(params_extract_audio);

        Logger.debug("61.5. removing file from ffmpeg local temp repo");
        await fsUnlink(input);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    Logger.debug("61.6. Writing ffmpeg output to output location");
    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "audioGoogle.flac",
        Body: await fsReadFile(output)
    }
    await S3PutObject(s3Params);

    // 9. updating JobAssignment with jobOutput
    Logger.debug("61.7. Associate output location with job output");
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();
}

extractAudio.profileName = "ExtractAudio";

module.exports = {
    extractAudio
};