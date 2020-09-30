import { ResourceManager } from "@mcma/client";
import { TransformJob, JobParameterBag, JobProfile, McmaException } from "@mcma/core";
import { BlobStorageFileLocator, BlobStorageFolderLocator } from "@mcma/azure-blob-storage";

export async function runFFmpegThumbnailJob(resourceManager: ResourceManager, inputFile: BlobStorageFileLocator, uuid: string, terraformOutput: any): Promise<string> {
    const jobProfiles = await resourceManager.query<JobProfile>(JobProfile, { name: "ExtractThumbnail" });
    if (!jobProfiles || jobProfiles.length === 0) {
        throw new McmaException("JobProfile with the name 'ExtractThumbnail' not found.");
    }
    if (jobProfiles.length > 1) {
        throw new McmaException("Found more than one JobProfile with the name 'ExtractThumbnail'.");
    }

    let transformJob = new TransformJob({
        jobProfileId: jobProfiles[0].id,
        jobInput: new JobParameterBag({
            inputFile,
            outputLocation: new BlobStorageFolderLocator({
                storageAccountName: terraformOutput.media_storage_account_name.value,
                container: terraformOutput.output_container.value,
                folderPath: uuid + "/thumbnail"
            })
        })
    });

    transformJob = await resourceManager.create(transformJob);

    return transformJob.id;
}