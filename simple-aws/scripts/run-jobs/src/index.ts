import * as AWS from "aws-sdk";
import * as node_fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

import { JobStatus } from "@mcma/core";
import { AwsS3FileLocator, getS3Url } from "@mcma/aws-s3";

import { createResourceManager } from "./create-resource-manager";
import { uploadFile } from "./upload-file";
import { runMediaInfoJob } from "./run-mediainfo-job";
import { runFFmpegThumbnailJob } from "./run-ffmpeg-thumbnail-job";
import { pollJobsForCompletion } from "./poll-jobs-for-completion";

const AWS_CREDENTIALS = "../../deployment/aws-credentials.json";

AWS.config.loadFromPath(AWS_CREDENTIALS);

global["fetch"] = node_fetch;

async function main() {
    if (!process.argv || process.argv.length < 3) {
        console.error("Must provide a file to process as an argument");
        return;
    }

    const file = process.argv[2];
    const runMediaInfo = true;
    const runFFmpegThumbnail = true;

    try {
        const resourceManager = createResourceManager();

        const uploadedFileLocator = await uploadFile(file);

        const uuid = uuidv4();
        const jobIds = [];
        
        let mediaInfoJobId: string;
        if (runMediaInfo) {
            console.log("Starting MediaInfo job...");
            mediaInfoJobId = await runMediaInfoJob(resourceManager, uploadedFileLocator, uuid);
            jobIds.push(mediaInfoJobId);
            console.log("MediaInfo job successfully started: " + mediaInfoJobId);
        }
        
        let ffmpegThumbnailJobId: string;
        if (runFFmpegThumbnail) {
            console.log("Starting FFmpeg thumbnail job...");
            ffmpegThumbnailJobId = await runFFmpegThumbnailJob(resourceManager, uploadedFileLocator, uuid);
            jobIds.push(ffmpegThumbnailJobId);
            console.log("FFmpeg thumbnail job successfully started: " + ffmpegThumbnailJobId);
        }

        console.log("Polling jobs for completion...");
        const jobs = await pollJobsForCompletion(resourceManager, jobIds);

        if (mediaInfoJobId) {
            const mediaInfoJob = jobs[mediaInfoJobId];
            if (mediaInfoJob.status === JobStatus.Completed) {
                const fileLocator = mediaInfoJob.jobOutput.get<AwsS3FileLocator>("outputFile");
                console.log("MediaInfo output: " + await getS3Url(fileLocator, "us-east-1"));
            } else {
                console.error(`MediaInfo job finished with status ${mediaInfoJob.status}`);
            }
        }

        if (ffmpegThumbnailJobId) {
            const ffmpegThumbnailJob = jobs[ffmpegThumbnailJobId];
            if (ffmpegThumbnailJob.status === JobStatus.Completed) {
                const fileLocator = ffmpegThumbnailJob.jobOutput.get<AwsS3FileLocator>("outputFile");
                console.log("FFmpeg thumbnail output: " + await getS3Url(fileLocator, "us-east-1"));
            } else {
                console.error(`FFmpeg thumbnail job finished with status ${ffmpegThumbnailJob.status}`);
            }
        }
    } catch (error) {
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(() => console.log("Done"));
