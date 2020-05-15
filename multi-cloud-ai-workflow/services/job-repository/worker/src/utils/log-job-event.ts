import { Job, JobProcess, JobProfile, JobStatus, Logger } from "@mcma/core";
import { ResourceManager } from "@mcma/client";

export async function logJobEvent(logger: Logger, resourceManager: ResourceManager, job: Job) {
    logger.debug("logJobEvent: job");
    logger.debug(job);

    let jobProfile: JobProfile;
    try {
        jobProfile = await resourceManager.get<JobProfile>(job.jobProfile);
    } catch (error) {
        logger.warn("Failed to get jobProfile");
        logger.warn(error);
    }

    logger.debug("logJobEvent: jobProfile");
    logger.debug(jobProfile);

    let jobProcess: JobProcess;
    try {
        jobProcess = await resourceManager.get<JobProcess>(job.jobProcess);
    } catch (error) {
        logger.warn("Failed to get jobProcess");
        logger.warn(error);
    }

    logger.debug("logJobEvent: jobProcess");
    logger.debug(jobProcess);

    const msg = {
        jobId: job.id,
        jobType: job["@type"],
        jobProfile: job.jobProfile,
        jobProfileName: jobProfile?.name,
        jobProcess: job.jobProcess,
        jobAssignment: jobProcess?.jobAssignment,
        jobInput: job.jobInput,
        jobStatus: job.status,
        jobStatusMessage: job.statusMessage,
        jobActualStartDate: jobProcess?.actualStartDate,
        jobActualEndDate: jobProcess?.actualEndDate,
        jobActualDuration: jobProcess?.actualDuration,
        jobOutput: job.jobOutput
    };

    switch (job.status) {
        case JobStatus.Queued:
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
