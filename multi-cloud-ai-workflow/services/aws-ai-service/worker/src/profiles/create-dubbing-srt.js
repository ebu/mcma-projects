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

async function createDubbingSrt(workerJobHelper) {
    const jobInput = workerJobHelper.getJobInput();

    // 6. Execute ffmepg on input file
    // Logger.debug("6. Execute ffmepg on input file");
    const inputFile = jobInput.inputFile;
    const outputLocation = jobInput.outputLocation;

    let tempFilename;
    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        Logger.debug(" 6.1. obtain data from s3 object");
        const data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

        Logger.debug("6.2. write proxy to local ffmpeg tmp storage");
        const input = "/tmp/" + "proxy.mp4";
        await fsWriteFile(input, data.Body);

        Logger.debug("6.3. write dub to local tmp storage");
        const data_dub = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: "temp/ssmlTranslation.mp3" });
        const dub = "/tmp/" + "ssmlTranslation.mp3";
        await fsWriteFile(dub, data_dub.Body);

        Logger.debug("6.4. write srt to local tmp storage");
        const data_srt = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: "temp/srt_output_clean.srt" });
        const srt = "/tmp/" + "srt_output_clean.srt";
        await fsWriteFile(srt, data_srt.Body);

        Logger.debug("6.5. declare ffmpeg outputs");
        // the tmp directory is local to the ffmpeg running instance
        output = "/tmp/" + "srtproxy.mp4";
        dubbed = "/tmp/" + "dubbedproxy.mp4";

        //DUB MUST COME FIRST BEFORE SRT
        //ffmpeg -i input.mp4 -i input.mp3 -c copy -map 0:v:0 -map 1:a:0 output.mp4
        //ffmpeg -i main.mp4 -i newaudio -filter_complex "[0:a][1:a]amix=duration=shortest[a]" -map 0:v -map "[a]" -c:v copy out.mp4
        //const params_dub = ["-i", input, "-i", dub, "-c", "copy", "-map", "0:v:0", "-map", "1:a:0", dubbed];
        const params_dub = ["-i", input, "-i", dub, "-filter_complex", "[0:a][1:a]amix=duration=longest[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", dubbed ];
        console.log(params_dub);
        await ffmpeg(params_dub);

        //SRT
        //ffmpeg -i hifi.avi -i hifi.srt -acodec libfaac -ar 48000 -ab 128k -ac 2 -vcodec libx264 -vpre ipod640 -s 480x240 -b 256k -scodec mov_text hifi.m4v
        //ffmpeg -i inputVideo.mp4 -i inputSubtitle.srt -c copy -c:s mov_text outputVideo.mp4
        const params_srt = ["-i", dubbed, "-i", srt, "-c", "copy", "-c:s", "mov_text", output];
        console.log(params_srt);
        await ffmpeg(params_srt);

        // ffmpeg -i proxy.mp4 -i ssmlTranslation.mp3 -filter_complex "[0:a][1:a]amix=duration=shortest[a]" -map 0:v -map "[a]" -c:v copy out.mp4 && ffmpeg -i out.mp4 -i srt.srt -c copy -c:s mov_text outputVideo.mp4
        // ffmpeg -i proxy.mp4 -i ssmlTranslation.mp3 -filter_complex "[0:a][1:a]amix=duration=shortest[a]" -map 0:v -map "[a]" -c:v ; -i srt.srt -c copy -c:s mov_text outputVideo.mp4
        // burn subtitles in video. ffmpeg -i proxy.mp4 -i ssmlTranslation.mp3 -filter_complex "[0:a][1:a]amix=duration=shortest[a],subtitles=srt.srt" -map 0:v -map "[a]" -c:s mov_text outputVideo.mp4
//        const params_dub_srt = ["-i", input, "-i", dub, "-filter_complex", "[0:a][1:a]amix=duration=shortest[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", dubbed, "&&", "ffmpeg", "-i", dubbed, "-i", srt, "-c", "copy", "-c:s", "mov_text", output];
//        console.log(params_dub_srt);
//        await ffmpeg(params_dub_srt);

        Logger.debug("6.6. removing local file");
        await fsUnlink(input);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    Logger.debug("7. Writing ffmepg output to output location");

    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "final.mp4",
        Body: await fsReadFile(output)
    }

    await S3PutObject(s3Params);

    // 9. updating JobAssignment with jobOutput
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