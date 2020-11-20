import { ResourceManager } from "@mcma/client";
import { Job, JobStatus, JobParameterBag, McmaException } from "@mcma/core";

async function delay(timeInMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(() => resolve(), timeInMs));
}

export async function pollJobsForCompletion(resourceManager: ResourceManager, jobIds: string[]): Promise<{ [key: string]: Job }> {
    const pollUntil = Date.now() + (2 * 60 * 1000);
    const completedJobs =
        await Promise.all(
            jobIds.map(async jobId => {
                let job = await resourceManager.get<Job>(jobId);

                while (job.status !== JobStatus.Completed && job.status !== JobStatus.Failed && job.status !== JobStatus.Canceled) {
                    if (Date.now() >= pollUntil) {
                        throw new McmaException("Timeout elapsed waiting for job to complete.");
                    }
                    await delay(3000);
                    job = await resourceManager.get<Job>(jobId);
                }

                console.log("Job " + jobId + " finished with status " + job.status);

                return job;
            })
        );

    return completedJobs.reduce((agg, cur) => {
        cur.jobOutput = new JobParameterBag(cur.jobOutput);
        agg[cur.id] = cur;
        return agg;
    }, {});
}