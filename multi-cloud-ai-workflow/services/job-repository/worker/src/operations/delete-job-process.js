//"use strict";

async function deleteJobProcess(providers, workerRequest) {
    const jobProcessId = workerRequest.input.jobProcessId;

    const logger = providers.getLoggerProvider().get(workerRequest.tracker);
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);

    try {
        let resourceEndpoint = await resourceManager.getResourceEndpointClient(jobProcessId);
        await resourceEndpoint.delete(jobProcessId);
    } catch (error) {
        logger.warn("Failed to delete JobProcess: " + jobProcessId);
        logger.warn(error.toString());
    }
}

module.exports = {
    deleteJobProcess
};
