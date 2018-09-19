const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const util = require('util');
const uuidv4 = require('uuid/v4');

const execFile = util.promisify(childProcess.execFile);
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_CORE = require("mcma-core");

const ffmpeg = async (params) => {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, 'bin/ffmpeg'), params);

        return {
            stdout: stdout,
            stderr: stderr
        }
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
};

async function start(jobInput) {
    console.log(JSON.stringify(jobInput, null, 2));

    let inputFile = jobInput.inputFile;
    let outputLocation = jobInput.outputLocation;

    if (!inputFile.awsS3Bucket || !inputFile.awsS3Key) {
        throw new Error("Not able to obtain input file");
    }

    // 1. obtain data from s3 object
    console.log("1. obtain data from s3 object");
    let data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

    // 2. write data to local tmp storage
    console.log("2. write data to local tmp storage");
    let localFilename = "/tmp/" + uuidv4();
    await fsWriteFile(localFilename, data.Body);

    // 3. obtain ffmpeg output
    let tempFilename = "/tmp/" + uuidv4() + ".mp4";
    let params = [
        "-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt", "yuv420p", tempFilename
    ];

    console.log("3. running ffmpeg with params", JSON.stringify(params, null, 2));
    let output = await ffmpeg(params);
    console.log("FFmpeg output", JSON.stringify(output, null, 2));

    // 4. removing local file
    console.log("4. removing local file");
    await fsUnlink(localFilename);

    // 5. Writing ffmepg output to output location
    console.log("5. Writing ffmepg output to output location");
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".mp4",
        Body: await fsReadFile(tempFilename)
    };

    data = await S3PutObject(s3Params);

    // 6. removing temp file
    console.log("6. removing temp file");
    await fsUnlink(tempFilename);

    // 7. updating JobAssignment with jobOutput
    console.log("7. returning job output")
    return new MCMA_CORE.JobParameterBag({
        outputFile: new MCMA_CORE.Locator({
            awsS3Bucket: s3Params.Bucket,
            awsS3Key: s3Params.Key
        })
    });
}

module.exports = { start };