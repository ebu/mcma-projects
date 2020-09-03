import * as util from "util";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { McmaException, TransformJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

import { ffmpeg } from "../ffmpeg";

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

const AWS = require("aws-sdk");
const S3 = new AWS.S3();

export async function extractThumbnail(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<TransformJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    if (!inputFile.bucket || !inputFile.key) {
        throw new McmaException("Failed to find bucket and/or key properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }

    let tempId = uuidv4();
    let tempVideoFile = "/tmp/video_" + tempId + ".mp4";
    let tempThumbFile = "/tmp/thumb_" + tempId + ".png";

    try {
        logger.info("Get video from s3 location: " + inputFile.bucket + " " + inputFile.key);
        const data = await S3.getObject(
            {
                Bucket: inputFile.bucket,
                Key: inputFile.key
            }).promise();

        logger.info("Write video to local storage");
        await fsWriteFile(tempVideoFile, data.Body);

        await ffmpeg(["-i", tempVideoFile, "-vf", "scale=200:-1", tempThumbFile]);

        const s3Params = {
            Bucket: outputLocation.bucket,
            Key: (outputLocation.keyPrefix ? outputLocation.keyPrefix : "") + tempId + ".png",
            ContentType: "image/png",
            Body: await fs.createReadStream(tempThumbFile)
        };

        await S3.upload(s3Params).promise();

        // 9. updating JobAssignment with jobOutput
        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            bucket: s3Params.Bucket,
            key: s3Params.Key
        }));

        await jobAssignmentHelper.complete();
    } finally {
        try {
            await fsUnlink(tempVideoFile);
        } catch (ignored) {}

        try {
            await fsUnlink(tempThumbFile);
        } catch (ignored) {}
    }
}
