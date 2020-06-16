import * as util from "util";
import * as fs from "fs";
import * as AWS from "aws-sdk";
import { AIJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

import { ffmpeg } from "../ffmpeg";

const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

const S3 = new AWS.S3();

// This Service has been setup to add previsouly cretaed subtitle (SRT) track and  dubbed audio track (voice over) to the source video using ffmpeg 
// see ffmpeg.js under src directory)

export async function createDubbingSrt(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    logger.debug("18. Add SRT subtitle and dubbed audio track (voice over) to source mp4 using ffmpeg");
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    let output;

    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        logger.debug("18.1. obtain data from s3 object");
        const data = await S3.getObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key }).promise();

        logger.debug("18.2. write copy of proxy input file to local ffmpeg tmp storage");
        // the tmp directory is local to the ffmpeg running instance
        const input = "/tmp/" + "proxy.mp4";
        await fsWriteFile(input, data.Body);

        logger.debug("18.3. write dub to ffmpeg local tmp storage");
        const data_dub = await S3.getObject({
            Bucket: inputFile.awsS3Bucket,
            Key: "temp/ssmlTranslation.mp3"
        }).promise();
        const dub = "/tmp/" + "ssmlTranslation.mp3";
        await fsWriteFile(dub, data_dub.Body);

        logger.debug("18.4. write srt of original language track to ffmpeg local tmp storage");
        const data_srt = await S3.getObject({
            Bucket: inputFile.awsS3Bucket,
            Key: "temp/srt_output_clean.srt"
        }).promise();
        const srt = "/tmp/" + "srt_output_clean.srt";
        await fsWriteFile(srt, data_srt.Body);

        logger.debug("18.5. declare ffmpeg outputs");
        output = "/tmp/" + "srtproxy.mp4";
        const dubbed = "/tmp/" + "dubbedproxy.mp4";

        logger.debug("18.6. add new dubbed track");
        //DUB MUST COME FIRST BEFORE SRT
        //ffmpeg -i main.mp4 -i newaudio -filter_complex "[0:a][1:a]amix=duration=shortest[a]" -map 0:v -map "[a]" -c:v copy out.mp4
        const params_dub = ["-i", input, "-i", dub, "-filter_complex", "[0:a][1:a]amix=duration=longest[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", dubbed];
        logger.debug(params_dub);
        await ffmpeg(params_dub);

        logger.debug("18.7. add new SRT track");
        //SRT
        //ffmpeg -i inputVideo.mp4 -i inputSubtitle.srt -c copy -c:s mov_text outputVideo.mp4
        const params_srt = ["-i", dubbed, "-i", srt, "-c", "copy", "-c:s", "mov_text", output];
        logger.debug(params_srt);
        await ffmpeg(params_srt);

        // Copy two srt (original english plus french translation) in one mp4 file
        //ffmpeg -i proxy.mp4 -i srt.srt -i french.srt -c:s mov_text -c:v copy -c:a copy -map 0:v -map 0:a -map 1 -map 2 -metadata:s:s:0 language=eng -metadata:s:s:1 language=fre With2CC.mp4
        // TBD but HTML5 player doesn't play srt, only VTT.

        logger.debug("18.8. removing file from ffmpeg local temp repo");
        await fsUnlink(input);

    } else {
        throw new Error("Not able to obtain input file");
    }

    // 7. Writing ffmepg output to output location
    logger.debug("18.9. Writing ffmpeg output to output location");
    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + "final.mp4",
        Body: await fsReadFile(output)
    };
    await S3.putObject(s3Params).promise();

    // 9. updating JobAssignment with jobOutput
    logger.debug("18.10. Associate output location with job output");
    jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    }));

    await jobAssignmentHelper.complete();
}
