
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";

import { McmaException } from "@mcma/core";
import { AwsS3FileLocator } from "@mcma/aws-s3";

import { TerraformOutput } from "./terraform-output";

export async function uploadFile(localFilePath: string): Promise<AwsS3FileLocator> {
    if (!fs.existsSync(localFilePath)) {
        throw new McmaException(`Local file not found at provided path '${localFilePath}`);
    }

    const key = path.basename(localFilePath, path.extname(localFilePath)) + "-" + uuidv4() + path.extname(localFilePath);
    const bucket = TerraformOutput.upload_bucket.value;

    const s3Client = new AWS.S3();

    const uploadResp = await s3Client.upload({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(localFilePath)
    }).promise();
    
    return new AwsS3FileLocator({
        awsS3Bucket: uploadResp.Bucket,
        awsS3Key: uploadResp.Key
    });
}