//"use strict";
import * as util from "util";
import { uuid } from "uuidv4";
import * as fs from "fs";
import * as AWS from "aws-sdk";

import { McmaException, TransformJob, JobParameterBag } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

import { ffmpeg } from "../ffmpeg";

const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);
const S3 = new AWS.S3();

export async function createProxyLambda(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<TransformJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;

    // 6. Execute ffmpeg on input file
    // logger.debug("6. Execute ffmpeg on input file");
    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    let tempFilename;
    if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        // 6.1. obtain data from s3 object
        logger.debug(" 6.1. obtain data from s3 object");
        const data = await S3.getObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key }).promise();

        // 6.2. write data to local tmp storage
        logger.debug("6.2. write data to local tmp storage");
        const localFilename = "/tmp/" + uuid();
        await fsWriteFile(localFilename, data.Body);

        // 6.3. obtain ffmpeg output
        logger.debug("6.3. obtain ffmpeg output");
        tempFilename = "/tmp/" + uuid() + ".mp4";
        const params = ["-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt", "yuv420p", tempFilename];
        await ffmpeg(params);

        // 6.4. removing local file
        logger.debug("6.4. removing local file");
        await fsUnlink(localFilename);

    } else {
        throw new McmaException("Not able to obtain input file");
    }

    // 7. Writing ffmpeg output to output location
    // Logger.debug("7. Writing ffmpeg output to output location");

    const s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuid() + ".mp4",
        Body: await fsReadFile(tempFilename)
    };

    await S3.putObject(s3Params).promise();

    // 8. removing temp file
    // Logger.debug("8. removing temp file");
    await fsUnlink(tempFilename);

    // 9. updating JobAssignment with jobOutput
    jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    }));

    await jobAssignmentHelper.complete();
}
