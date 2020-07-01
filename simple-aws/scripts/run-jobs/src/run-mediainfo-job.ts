import { JobProfile, McmaException, JobParameterBag, AmeJob } from "@mcma/core";
import { ResourceManager } from "@mcma/client";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";

import { TerraformOutput } from "./terraform-output";

export async function runMediaInfoJob(resourceManager: ResourceManager, inputFile: AwsS3FileLocator, uuid: string): Promise<string> {
    const jobProfiles = await resourceManager.query<JobProfile>(JobProfile, { name: "ExtractTechnicalMetadata" });
    if (!jobProfiles || jobProfiles.length === 0) {
        throw new McmaException("JobProfile with the name 'ExtractTechnicalMetadata' not found.");
    }
    if (jobProfiles.length > 1) {
        throw new McmaException("Found more than one JobProfile with the name 'ExtractTechnicalMetadata'.");
    }

    let ameJob = new AmeJob({
        jobProfile: jobProfiles[0].id,
        jobInput: new JobParameterBag({
            inputFile,
            outputLocation: new AwsS3FolderLocator({
                awsS3Bucket: TerraformOutput.output_bucket.value,
                awsS3KeyPrefix: uuid + "/metadata-"
            })
        })
    });

    ameJob = await resourceManager.create(ameJob);

    return ameJob.id;
}