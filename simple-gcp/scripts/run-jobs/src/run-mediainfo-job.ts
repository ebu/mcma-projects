import { JobProfile, McmaException, JobParameterBag, AmeJob } from "@mcma/core";
import { ResourceManager } from "@mcma/client";
import { CloudStorageFileLocatorProperties, CloudStorageFolderLocator } from "@mcma/google-cloud-storage";

import { TerraformOutput } from "./terraform-output";

export async function runMediaInfoJob(resourceManager: ResourceManager, inputFile: CloudStorageFileLocatorProperties, uuid: string): Promise<string> {
    const jobProfiles = await resourceManager.query<JobProfile>(JobProfile, { name: "ExtractTechnicalMetadata" });
    if (!jobProfiles || jobProfiles.length === 0) {
        throw new McmaException("JobProfile with the name 'ExtractTechnicalMetadata' not found.");
    }
    if (jobProfiles.length > 1) {
        throw new McmaException("Found more than one JobProfile with the name 'ExtractTechnicalMetadata'.");
    }

    let ameJob = new AmeJob({
        jobProfileId: jobProfiles[0].id,
        jobInput: new JobParameterBag({
            inputFile,
            outputLocation: new CloudStorageFolderLocator({
                bucket: TerraformOutput.output_bucket.value,
                folderPath: uuid + "/metadata/"
            })
        })
    });

    ameJob = await resourceManager.create(ameJob);

    return ameJob.id;
}