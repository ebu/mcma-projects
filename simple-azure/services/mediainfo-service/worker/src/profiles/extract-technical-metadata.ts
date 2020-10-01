import * as fs from "fs";
import * as util from "util";
import { v4 as uuidv4 } from "uuid";

import { AmeJob, McmaException } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import {
    BlobStorageFileLocator,
    BlobStorageFileLocatorProperties, BlobStorageFolderLocator,
    BlobStorageFolderLocatorProperties,
    getFileProxy, getFolderProxy
} from "@mcma/azure-blob-storage";

import { mediaInfo } from "../media-info";

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

export async function extractTechnicalMetadata(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AmeJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    logger.info("Execute media info on input file");
    const inputFile = jobInput.get<BlobStorageFileLocatorProperties>("inputFile");
    if (!inputFile.storageAccountName || !inputFile.container || !inputFile.filePath) {
        throw new McmaException("Failed to find storageAccountName, container, or filePath properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }

    const outputLocation = jobInput.get<BlobStorageFolderLocatorProperties>("outputLocation");

    const tempId = uuidv4();

    const inputFilePath = `D:\\local\\temp\\${tempId}.mp4`;
    const outputFileName = `${tempId}.json`;
    const outputFilePath = `D:\\local\\temp\\${outputFileName}`;

    let outputFileReader;
    try {
        logger.info("Get video from location: " + inputFile.container + " " + inputFile.filePath);

        const inputFileProxy = getFileProxy(new BlobStorageFileLocator(inputFile), providers.contextVariableProvider);
        const data = await inputFileProxy.get();

        logger.info("Write video to local storage");
        await fsWriteFile(inputFilePath, data);

        logger.info("obtain mediainfo output");
        const output = await mediaInfo(logger, ["--Output=EBUCore_JSON", inputFilePath]);

        logger.info("check if we have mediaInfo output");
        if (!output || !output.stdout) {
            throw new McmaException("Failed to obtain mediaInfo output");
        }

        logger.info("Writing mediaInfo output to output location");
        const outputFileProxy = getFolderProxy(new BlobStorageFolderLocator(outputLocation), providers.contextVariableProvider);

        jobAssignmentHelper.jobOutput.set(
            "outputFile",
            await outputFileProxy.putAsText(
                outputFileName,
                output.stdout,
                {
                    blobHTTPHeaders: { blobContentType: "application/json" }
                }));

        logger.info("Marking JobAssignment as completed");
        await jobAssignmentHelper.complete();
    } finally {
        try {
            logger.info("removing local file");
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
