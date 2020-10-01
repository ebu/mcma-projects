import { ResourceManager } from "@mcma/client";
import { TransformJob, JobParameterBag, JobProfile, McmaException } from "@mcma/core";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";

import { TerraformOutput } from "./terraform-output";

export async function runFFmpegThumbnailJob(resourceManager: ResourceManager, inputFile: AwsS3FileLocator, uuid: string): Promise<string> {
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
            outputLocation: new AwsS3FolderLocator({
                bucket: TerraformOutput.output_bucket.value,
                keyPrefix: uuid + "/thumbnail-"
            })
        })
    });

    transformJob = await resourceManager.create(transformJob);

    return transformJob.id;
}