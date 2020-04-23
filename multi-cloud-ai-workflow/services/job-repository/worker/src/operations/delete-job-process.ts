//"use strict";

import { ProviderCollection, WorkerRequest } from "@mcma/worker";

export async function deleteJobProcess(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobProcessId = workerRequest.input.jobProcessId;

    const logger = providers.loggerProvider.get(workerRequest.tracker);
    const resourceManager = providers.resourceManagerProvider.get(workerRequest);

    try {
        let resourceEndpoint = await resourceManager.getResourceEndpointClient(jobProcessId);
        await resourceEndpoint.delete(jobProcessId);
    } catch (error) {
        logger.warn("Failed to delete JobProcess: " + jobProcessId);
        logger.warn(error.toString());
    }
}
