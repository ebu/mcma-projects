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

  console.log(jobInput);

  let inputFile = jobInput.inputFile;
  let outputLocation = jobInput.outputLocation;

  let tempFilename;
  if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

    // 6.1. obtain data from s3 object
    console.log(" 6.1. obtain data from s3 object");
    let data = await
    S3GetObject({Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key});

    // 6.2. write data to local tmp storage
    console.log("6.2. write data to local tmp storage");
    let localFilename = "/tmp/" + uuidv4();
    await
    fsWriteFile(localFilename, data.Body);

    // 6.3. obtain ffmpeg output
    console.log("6.3. obtain ffmpeg output");
    tempFilename = "/tmp/" + uuidv4() + ".mp4";
    let params = [
      "-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt",
      "yuv420p", tempFilename
    ];
    let output = await
    ffmpeg(params);

    // 6.4. removing local file
    console.log("6.4. removing local file");
    await
    fsUnlink(localFilename);

  } else {
    throw new Error("Not able to obtain input file");
  }

  // 7. Writing ffmepg output to output location
  // console.log("7. Writing ffmepg output to output location");

  let s3Params = {
    Bucket: outputLocation.awsS3Bucket,
    Key: (
      outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : ""
    ) + uuidv4() + ".mp4",
    Body: await fsReadFile(tempFilename)
  };

  await
  S3PutObject(s3Params);

  // 8. removing temp file
  // console.log("8. removing temp file");
  await
  fsUnlink(tempFilename);

  // 9. updating JobAssignment with jobOutput
  return new MCMA_CORE.JobParameterBag({
    outputFile: new MCMA_CORE.Locator({
      awsS3Bucket: s3Params.Bucket,
      awsS3Key: s3Params.Key
    })
  });
}

module.exports = {start};