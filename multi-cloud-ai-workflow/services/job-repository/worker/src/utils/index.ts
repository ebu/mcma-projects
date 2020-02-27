import { ILogger, Job, JobStatus } from "@mcma/core";
import { ResourceManager } from "@mcma/client";

export async function logJobEvent(logger: ILogger, resourceManager: ResourceManager, job: Job) {
    logger.debug("logJobEvent: job");
    logger.debug(job);

    let jobProfile;
    try {
        // @ts-ignore TODO remove ignore when library supports it.
        jobProfile = await resourceManager.get(job.jobProfile);
    } catch (error) {
        logger.warn("Failed to get jobProfile");
        logger.warn(error);
    }

    logger.debug("logJobEvent: jobProfile");
    logger.debug(jobProfile);

    let jobProcess;
    try {
        // @ts-ignore TODO remove ignore when library supports it.
        jobProcess = await resourceManager.get(job.jobProcess);
    } catch (error) {
        logger.warn("Failed to get jobProcess");
        logger.warn(error);
    }

    logger.debug("logJobEvent: jobProcess");
    logger.debug(jobProcess);

    const msg = {
        jobId: job.id,
        jobType: job["@type"],
        // @ts-ignore TODO remove ignore when library supports it.
        jobProfile: job.jobProfile,
        jobProfileName: jobProfile?.name,
        // @ts-ignore TODO remove ignore when library supports it.
        jobProcess: job.jobProcess,
        jobAssignment: jobProcess?.jobAssignment,
        // @ts-ignore TODO remove ignore when library supports it.
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
            logger.log(400, "JOB_UPDATE", msg);
            break;
    }
}
