
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

import { McmaException } from "@mcma/core";
import { BlobStorageFileLocator, BlobStorageFolderLocator, getFolderProxy } from "@mcma/azure-blob-storage";

export async function uploadFile(localFilePath: string, terraformOutput: any): Promise<BlobStorageFileLocator> {
    if (!fs.existsSync(localFilePath)) {
        throw new McmaException(`Local file not found at provided path '${localFilePath}`);
    }

    const fileName = path.basename(localFilePath, path.extname(localFilePath)) + "-" + uuidv4() + path.extname(localFilePath);

    const containerLocator = new BlobStorageFolderLocator({
        storageAccountName: terraformOutput.media_storage_account_name.value,
        container: terraformOutput.upload_container.value,
        folderPath: ""
    });

    const containerProxy = getFolderProxy(containerLocator, terraformOutput.media_storage_connection_string.value);

    return containerProxy.put(fileName, fs.createReadStream(localFilePath));
}