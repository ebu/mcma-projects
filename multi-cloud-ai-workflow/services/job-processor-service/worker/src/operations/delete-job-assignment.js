//"use strict";

function deleteJobAssignment(resourceManagerProvider) {
    return async function deleteJobAssignment(event) {
        let jobAssignmentId = event.input.jobAssignmentId;

        try {
            let resourceManager = resourceManagerProvider.get(event);
            await resourceManager.delete(jobAssignmentId);
        } catch (error) {
            console.log(error);
        }
    };
}

module.exports = deleteJobAssignment;