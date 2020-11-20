import * as fs from "fs";
import * as util from "util";
import { v4 as uuidv4 } from "uuid";

import { AmeJob, McmaException } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import {
    CloudStorageFileLocatorProperties,
    CloudStorageFileProxy,
    CloudStorageFolderLocatorProperties,
    CloudStorageFolderProxy
} from "@mcma/google-cloud-storage";

import { mediaInfo } from "../media-info";

const fsUnlink = util.promisify(fs.unlink);

export async function extractTechnicalMetadata(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AmeJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<CloudStorageFileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<CloudStorageFolderLocatorProperties>("outputLocation");

    if (!inputFile.bucket || !inputFile.filePath) {
        throw new McmaException("Not able to obtain input file");
    }

    const tempId = uuidv4();
    const tempVideoFile = "/tmp/video_" + tempId + ".mp4";
    const jsonFile = tempId + ".json";

    try {
        logger.info("Downloading file '" + inputFile.filePath + "' from bucket '" + inputFile.bucket + "'...");
        const inputFileProxy = new CloudStorageFileProxy(inputFile);
        await inputFileProxy.downloadToStream(fs.createWriteStream(tempVideoFile));
        logger.info("File successfully downloaded to '" + tempVideoFile + "'. Running MediaInfo...");

        const { stdout, stderr } = await mediaInfo(logger, ["--Output=EBUCore_JSON", tempVideoFile]);
        if (!stdout) {
            throw new McmaException("Failed to obtain mediaInfo output. Error Output:\n" + stderr);
        }
        logger.info("MediaInfo completed successfully. Uploading JSON to '" + outputLocation.folderPath + "' in bucket '" + outputLocation.bucket + "'...");

        const outputFolderProxy = new CloudStorageFolderProxy(outputLocation);
        const outputFile = await outputFolderProxy.uploadAsText(jsonFile, stdout, { contentType: "application/json" });
        logger.info("JSON upload completed successfully. Setting output and completing job...");

        jobAssignmentHelper.jobOutput.set("outputFile", outputFile);
        await jobAssignmentHelper.complete();
        logger.info("Job completed successfully.");
    } finally {
        try {
            await fsUnlink(tempVideoFile);
        } catch { }
    }
}
