import { Job, JobExecution, JobProfile, JobStatus, Logger } from "@mcma/core";
import { ResourceManager } from "@mcma/client";

export async function logJobEvent(logger: Logger, resourceManager: ResourceManager, job: Job, jobExecution: JobExecution) {
    let jobProfile: JobProfile;
    try {
        jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);
    } catch (error) {
        logger.warn("Failed to get jobProfile");
        logger.warn(error);
    }

    const msg = {
        jobId: job.id,
        jobType: job["@type"],
        jobProfile: job.jobProfile,
        jobProfileName: jobProfile?.name,
        jobExecution: jobExecution.id,
        jobAssignment: jobExecution.jobAssignment,
        jobInput: job.jobInput,
        jobStatus: job.status,
        jobError: job.error,
        jobActualStartDate: jobExecution?.actualStartDate,
        jobActualEndDate: jobExecution?.actualEndDate,
        jobActualDuration: jobExecution?.actualDuration,
        jobOutput: job.jobOutput
    };

    switch (job.status) {
        case JobStatus.Scheduled:
            logger.jobStart(msg);
            break;
        case JobStatus.Failed:
        case JobStatus.Canceled:
        case JobStatus.Completed:
            logger.jobEnd(msg);
            break;
        default:
            logger.jobUpdate(msg);
            break;
    }
}
