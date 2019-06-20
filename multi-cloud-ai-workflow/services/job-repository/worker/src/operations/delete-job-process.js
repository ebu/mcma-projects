//"use strict";

const AWS = require("aws-sdk");
const { getAwsV4ResourceManager } = require("mcma-aws");

const createResourceManager = getAwsV4ResourceManager.getResourceManager;

const deleteJobProcess = async (event) => {
    let jobProcessId = event.input.jobProcessId;

    try {
        let resourceManager = createResourceManager(event);
        await resourceManager.delete(jobProcessId);
    } catch (error) {
        console.log(error);
    }
}

module.exports = deleteJobProcess;