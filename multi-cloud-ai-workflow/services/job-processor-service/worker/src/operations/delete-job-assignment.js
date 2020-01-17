//"use strict";

async function deleteJobAssignment(providers, workerRequest) {
    const jobAssignmentId = workerRequest.input.jobAssignmentId;

    const logger = providers.getLoggerProvider().get(workerRequest.tracker);
    const resourceManager = providers.getResourceManagerProvider().get(workerRequest);

    try {
        let resourceEndpoint = await resourceManager.getResourceEndpointClient(jobAssignmentId);
        await resourceEndpoint.delete(jobAssignmentId);
    } catch (error) {
        logger.warn("Failed to delete JobAssignment: " + jobAssignmentId);
        logger.warn(error.toString());
    }
}

module.exports = {
    deleteJobAssignment
};
