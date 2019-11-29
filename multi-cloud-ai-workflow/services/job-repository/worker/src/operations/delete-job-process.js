//"use strict";

const { getAwsV4ResourceManager } = require("mcma-aws");

const deleteJobProcess = async (event) => {
    let jobProcessId = event.input.jobProcessId;

    try {
        let resourceManager = getAwsV4ResourceManager(event);
        await resourceManager.delete(jobProcessId);
    } catch (error) {
        console.log(error);
    }
}

module.exports = deleteJobProcess;