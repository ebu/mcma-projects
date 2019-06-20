//"use strict";

const AWS = require("aws-sdk");

const { getAwsV4ResourceManager } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;

const deleteJobAssignment = async (event) => {
    let jobAssignmentId = event.jobAssignmentId;

    try {
        let resourceManager = createResourceManager(event);
        await resourceManager.delete(jobAssignmentId);
    } catch (error) {
        console.log(error);
    }
}

module.exports = deleteJobAssignment;