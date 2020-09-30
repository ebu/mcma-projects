import * as fs from "fs";
import * as node_fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import { JobStatus } from "@mcma/core";
import { BlobStorageFileLocator, BlobStorageFileLocatorProperties, getFileProxy } from "@mcma/azure-blob-storage";

import { createResourceManager } from "./create-resource-manager";
import { uploadFile } from "./upload-file";
import { runMediaInfoJob } from "./run-mediainfo-job";
import { runFFmpegThumbnailJob } from "./run-ffmpeg-thumbnail-job";
import { pollJobsForCompletion } from "./poll-jobs-for-completion";

global["fetch"] = node_fetch;

const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

const localFilePath = process.argv.find(x => x.startsWith("--testFilePath=")).replace("--testFilePath=", "");

async function main() {
    const runMediaInfo = true;
    const runFFmpegThumbnail = true;

    try {
        const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));
        const resourceManager = createResourceManager(terraformOutput);

        const uploadedFileLocator = await uploadFile(localFilePath, terraformOutput);

        const uuid = uuidv4();
        const jobIds = [];
        
        let mediaInfoJobId: string;
        if (runMediaInfo) {
            console.log("Starting MediaInfo job...");
            mediaInfoJobId = await runMediaInfoJob(resourceManager, uploadedFileLocator, uuid, terraformOutput);
            jobIds.push(mediaInfoJobId);
            console.log("MediaInfo job successfully started: " + mediaInfoJobId);
        }
        
        let ffmpegThumbnailJobId: string;
        if (runFFmpegThumbnail) {
            console.log("Starting FFmpeg thumbnail job...");
            ffmpegThumbnailJobId = await runFFmpegThumbnailJob(resourceManager, uploadedFileLocator, uuid, terraformOutput);
            jobIds.push(ffmpegThumbnailJobId);
            console.log("FFmpeg thumbnail job successfully started: " + ffmpegThumbnailJobId);
        }

        console.log("Polling jobs for completion...");
        const jobs = await pollJobsForCompletion(resourceManager, jobIds);

        if (mediaInfoJobId) {
            const mediaInfoJob = jobs[mediaInfoJobId];
            if (mediaInfoJob.status === JobStatus.Completed) {
                const fileLocator = new BlobStorageFileLocator(mediaInfoJob.jobOutput.get<BlobStorageFileLocatorProperties>("outputFile"));
                const fileLocatorProxy = getFileProxy(fileLocator, terraformOutput.media_storage_connection_string.value);
                console.log("MediaInfo output: " + fileLocatorProxy.getPublicReadOnlyUrl());
            } else {
                console.error(`MediaInfo job finished with status ${mediaInfoJob.status}`);
            }
        }

        if (ffmpegThumbnailJobId) {
            const ffmpegThumbnailJob = jobs[ffmpegThumbnailJobId];
            if (ffmpegThumbnailJob.status === JobStatus.Completed) {
                const fileLocator = new BlobStorageFileLocator(ffmpegThumbnailJob.jobOutput.get<BlobStorageFileLocatorProperties>("outputFile"));
                const fileLocatorProxy = getFileProxy(fileLocator, terraformOutput.media_storage_connection_string.value);
                console.log("FFmpeg output: " + fileLocatorProxy.getPublicReadOnlyUrl());
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
