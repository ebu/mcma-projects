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


// This Service has been setup to add previsouly cretaed subtitle (SRT) track and  dubbed audio track (voice over) to the source video using ffmpeg 
// see ffmpeg.js under src directory)

async function createDubbingSrt(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();

    Logger.debug("51. Add SRT subtitle and dubbed audio track (voice over) to source mp4 using ffmpeg");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    let tempFilename;
    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        Logger.debug("51.1. obtain data from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        Logger.debug("51.2. write proxy to local ffmpeg tmp storage");
        // the tmp directory is local to the ffmpeg running instance
        const input = "/tmp/" + "proxy_google.mp4";
        await fsWriteFile(input, data.Body);

        Logger.debug("51.3. write dub to ffmpeg local tmp storage");
        const data_dub = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: "temp/ssmlTranslation.mp3" });
        const dub = "/tmp/" + "ssmlTranslation.mp3";
        await fsWriteFile(dub, data_dub.Body);

        Logger.debug("51.4. write srt of original language track to ffmpeg local tmp storage");
        const data_srt = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: "temp/srt_output_clean.srt" });
        const srt = "/tmp/" + "srt_output_clean.srt";
        await fsWriteFile(srt, data_srt.Body);

        Logger.debug("51.5. declare ffmpeg outputs");
        output = "/tmp/" + "srtproxy.mp4";
        dubbed = "/tmp/" + "dubbedproxy.mp4";

        Logger.debug("51.6. add new dubbed track");
        //DUB MUST COME FIRST BEFORE SRT
        //ffmpeg -i main.mp4 -i newaudio -filter_complex "[0:a][1:a]amix=duration=shortest[a]" -map 0:v -map "[a]" -c:v copy out.mp4
        const params_dub = ["-i", input, "-i", dub, "-filter_complex", "[0:a][1:a]amix=duration=longest[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", dubbed ];
        console.log(params_dub);
        await ffmpeg(params_dub);

        Logger.debug("51.7. add new SRT track");
        //SRT
        //ffmpeg -i inputVideo.mp4 -i inputSubtitle.srt -c copy -c:s mov_text outputVideo.mp4
        const params_srt = ["-i", dubbed, "-i", srt, "-c", "copy", "-c:s", "mov_text", output];
        console.log(params_srt);
        await ffmpeg(params_srt);

        // Copy two srt (original english plus french translation) in one mp4 file
        //ffmpeg -i proxy.mp4 -i srt.srt -i french.srt -c:s mov_text -c:v copy -c:a copy -map 0:v -map 0:a -map 1 -map 2 -metadata:s:s:0 language=eng -metadata:s:s:1 language=fre With2CC.mp4
        // TBD but HTML5 player doesn't play srt, only VTT.

        Logger.debug("51.8. removing file from ffmpeg local temp repo");
        await fsUnlink(input);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    Logger.debug("51.9. Writing ffmepg output to output location");
    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "final.mp4",
        Body: await fsReadFile(output)
    }
    await S3PutObject(s3Params);

    // 9. updating JobAssignment with jobOutput
    Logger.debug("51.10. Associate output location with job output");
    workerJobHelper.getJobOutput().outputFile = new Locator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    });

    await workerJobHelper.complete();
}

createDubbingSrt.profileName = "CreateDubbingSrt";

module.exports = {
    createDubbingSrt
};