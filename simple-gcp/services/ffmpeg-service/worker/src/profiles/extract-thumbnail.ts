import * as util from "util";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { McmaException, TransformJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import {
    CloudStorageFileLocatorProperties,
    CloudStorageFileProxy,
    CloudStorageFolderLocatorProperties,
    CloudStorageFolderProxy
} from "@mcma/google-cloud-storage";

import { ffmpeg } from "../ffmpeg";

const fsUnlink = util.promisify(fs.unlink);

export async function extractThumbnail(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<TransformJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<CloudStorageFileLocatorProperties>("inputFile");
    const outputLocation = jobInput.get<CloudStorageFolderLocatorProperties>("outputLocation");

    if (!inputFile.bucket || !inputFile.filePath) {
        throw new McmaException("Failed to find bucket and/or key properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }

    let tempId = uuidv4();
    let tempVideoFile = "/tmp/video_" + tempId + ".mp4";
    let tempThumbFile = "/tmp/thumb_" + tempId + ".png";

    try {
        logger.info("Get video from Cloud Storage location: " + inputFile.bucket + " " + inputFile.filePath);
        const inputFileProxy = new CloudStorageFileProxy(inputFile);

        await inputFileProxy.downloadToStream(fs.createWriteStream(tempVideoFile));

        await ffmpeg(logger,[
            "-i",
            tempVideoFile,
            "-ss",
            "00:00:00.500",
            "-vframes",
            "1",
            "-vf",
            "scale=200:-1",
            tempThumbFile
        ]);

        const outputFolderProxy = new CloudStorageFolderProxy(outputLocation);
        const outputFile = await outputFolderProxy.upload(tempId + ".png", fs.createReadStream(tempThumbFile), { contentType: "image/png"});

        // 9. updating JobAssignment with jobOutput
        jobAssignmentHelper.jobOutput.set("outputFile", outputFile);

        await jobAssignmentHelper.complete();
    } finally {
        try {
            await fsUnlink(tempVideoFile);
        } catch {}

        try {
            await fsUnlink(tempThumbFile);
        } catch {}
    }
}
