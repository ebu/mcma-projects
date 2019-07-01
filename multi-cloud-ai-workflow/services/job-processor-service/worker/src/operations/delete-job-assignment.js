//"use strict";

const { getAwsV4ResourceManager } = require("mcma-aws");

const deleteJobAssignment = async (event) => {
    let jobAssignmentId = event.input.jobAssignmentId;

    try {
        let resourceManager = getAwsV4ResourceManager(event);
        await resourceManager.delete(jobAssignmentId);
    } catch (error) {
        console.log(error);
    }
}

module.exports = deleteJobAssignment;