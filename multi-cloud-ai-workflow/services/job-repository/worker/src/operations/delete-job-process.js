//"use strict";
const { Logger } = require("@mcma/core");

function deleteJobProcess(resourceManagerProvider) {
    return async function deleteJobProcess(event) {
        let jobProcessId = event.input.jobProcessId;

        try {
            let resourceManager = resourceManagerProvider.get(event);
            await resourceManager.delete(jobProcessId);
        } catch (error) {
            Logger.exception(error);
        }
    };
}

module.exports = deleteJobProcess;