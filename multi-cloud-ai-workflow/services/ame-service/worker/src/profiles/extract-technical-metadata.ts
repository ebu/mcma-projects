import * as fs from "fs";
import * as util from "util";
import { v4 as uuidv4 } from "uuid";

import { AmeJob, McmaException } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties } from "@mcma/aws-s3";

import { mediaInfo } from "../media-info";
import * as AWS from "aws-sdk";

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

const S3 = new AWS.S3();

export async function extractTechnicalMetadata(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AmeJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;

    logger.info("Execute media info on input file");
    let inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    let outputLocation = jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");

    let output;

    if (inputFile.url) { // in case we receive a Locator with a url we"ll use the mediaInfo option that can analyze while downloading the file directly
        logger.info("obtaining mediainfo output based on url " + inputFile.url);
        output = await mediaInfo(["--Output=EBUCore_JSON", inputFile.url]);

    } else if (inputFile.awsS3Bucket && inputFile.awsS3Key) { // else we have to copy the file to internal storage (max 500mb) and analyze it directly
        logger.info("obtain data from s3 object Bucket: " + inputFile.awsS3Bucket + " and Key: " + inputFile.awsS3Key);
        let data = await S3.getObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key }).promise();

        logger.info("write data to local tmp storage");
        let localFilename = "/tmp/" + uuidv4();
        await fsWriteFile(localFilename, data.Body);

        logger.info("obtain mediainfo output");
        output = await mediaInfo(["--Output=EBUCore_JSON", localFilename]);

        logger.info("removing local file");
        await fsUnlink(localFilename);
    } else {
        throw new McmaException("Not able to obtain input file");
    }

    logger.info("check if we have mediaInfo output");
    if (!output || !output.stdout) {
        throw new McmaException("Failed to obtain mediaInfo output");
    }

    logger.info("Writing mediaInfo output to output location");
    let s3Params = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
        Body: output.stdout
    };

    await S3.putObject(s3Params).promise();

    logger.info("Adding Job Output");
    jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
        awsS3Bucket: s3Params.Bucket,
        awsS3Key: s3Params.Key
    }));

    logger.info("Marking JobAssignment as completed");
    await jobAssignmentHelper.complete();
}
