import { ResourceManager } from "@mcma/client";
import { McmaException } from "@mcma/core";

const jobProfileMap: { [key: string]: string } = {};

export async function getJobProfileId(resourceManager: ResourceManager, jobProfileName: string): Promise<string> {
    if (!jobProfileMap.hasOwnProperty(jobProfileName)) {
        const [jobProfile] = await resourceManager.query("JobProfile", { name: jobProfileName });

        if (!jobProfile) {
            throw new McmaException(`JobProfile '${jobProfileName}' not found`);
        }

        jobProfileMap[jobProfileName] = jobProfile.id;
    }
    return jobProfileMap[jobProfileName];
}
