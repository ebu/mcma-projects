import { ProviderCollection, WorkerRequest } from "@mcma/worker";

export async function deleteJobAssignment(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentId = workerRequest.input.jobAssignmentId;

    const logger = workerRequest.logger;
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    try {
        let resourceEndpoint = await resourceManager.getResourceEndpointClient(jobAssignmentId);
        await resourceEndpoint.delete(jobAssignmentId);
    } catch (error) {
        logger.warn("Failed to delete JobAssignment: " + jobAssignmentId);
        logger.warn(error?.toString());
    }
}
