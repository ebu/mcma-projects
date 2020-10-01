import * as util from "util";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { McmaException, TransformJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import {
    BlobStorageFileLocator,
    BlobStorageFileLocatorProperties, BlobStorageFolderLocator,
    BlobStorageFolderLocatorProperties,
    getFileProxy, getFolderProxy
} from "@mcma/azure-blob-storage";

import { ffmpeg } from "../ffmpeg";

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

export async function extractThumbnail(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<TransformJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    const inputFile = jobInput.get<BlobStorageFileLocatorProperties>("inputFile");
    if (!inputFile.storageAccountName || !inputFile.container || !inputFile.filePath) {
        throw new McmaException("Failed to find storageAccountName, container, or filePath properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }

    const outputLocation = jobInput.get<BlobStorageFolderLocatorProperties>("outputLocation");

    const tempId = uuidv4();

    const inputFilePath = `D:\\local\\temp\\${tempId}.mp4`;
    const outputFileName = `${tempId}.png`;
    const outputFilePath = `D:\\local\\temp\\${outputFileName}`;

    let outputFileReader;
    try {
        logger.info("Get video from location: " + inputFile.container + " " + inputFile.filePath);

        const inputFileProxy = getFileProxy(new BlobStorageFileLocator(inputFile), providers.contextVariableProvider);
        const data = await inputFileProxy.get();

        logger.info("Write video to local storage");
        await fsWriteFile(inputFilePath, data);

        await ffmpeg(logger,
    [
                "-i",
                inputFilePath,
                "-ss",
                "00:00:00.500",
                "-vframes",
                "1",
                "-vf",
                "scale=200:-1",
                outputFilePath
            ]);

        const outputFileProxy = getFolderProxy(new BlobStorageFolderLocator(outputLocation), providers.contextVariableProvider);
        outputFileReader = fs.createReadStream(outputFilePath);

        // 9. updating JobAssignment with jobOutput
        jobAssignmentHelper.jobOutput.set(
            "outputFile",
            await outputFileProxy.put(
                outputFileName,
                outputFileReader,
                {
                    blobHTTPHeaders: { blobContentType: "image/png" }
                }));

        await jobAssignmentHelper.complete();
    } finally {
        try {
            await fsUnlink(inputFilePath);
        } catch {}

        try {
            await fsUnlink(outputFilePath);
        } catch {}

        if (outputFileReader) {
            try {
                outputFileReader.close();
            } catch {}
        }
    }
}
