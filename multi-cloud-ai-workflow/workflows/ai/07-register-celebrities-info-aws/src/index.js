//"use strict";

// require
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-celebrities-aws": 80 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    throw new Error("Not Implemented");

    try {
        event.status = "RUNNING";
        event.parallelProgress = { "detect-celebrities-aws": 100 };
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
}
