
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

import { McmaException } from "@mcma/core";
import { CloudStorageFileLocator, CloudStorageFolderLocator, CloudStorageFolderProxy } from "@mcma/google-cloud-storage";

import { TerraformOutput } from "./terraform-output";

export async function uploadFile(keyFilename: string, localFilePath: string): Promise<CloudStorageFileLocator> {
    if (!fs.existsSync(localFilePath)) {
        throw new McmaException(`Local file not found at provided path '${localFilePath}`);
    }

    const fileName = path.basename(localFilePath, path.extname(localFilePath)) + "-" + uuidv4() + path.extname(localFilePath);
    const bucket = TerraformOutput.upload_bucket.value;

    const folderLocator = new CloudStorageFolderLocator({
        bucket,
        folderPath: ""
    });

    const folderProxy = new CloudStorageFolderProxy(folderLocator, { keyFilename });

    return await folderProxy.upload(fileName, fs.createReadStream(localFilePath));
}