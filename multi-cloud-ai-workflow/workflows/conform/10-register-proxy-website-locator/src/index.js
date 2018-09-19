//"use strict";

// require
const MCMA_CORE = require("mcma-core");

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * get the registered BMContent
 */
getBMContent = async(url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    return response.data;
}

/**
 * get the registered BMEssence
 */
getBMEssence = async(url) => {

    let response = await MCMA_CORE.HTTP.get(url);

    if (!response.data) {
        throw new Error("Faild to obtain BMContent");
    }

    return response.data;
}

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
        event.progress = 81;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // acquire the registered BMEssence
    let bme = await getBMEssence(event.data.bmEssence);

    // update BMEssence
    bme.locations = [ event.data.websiteFile ];

    bme = await resourceManager.update(bme);

    return bme.id;
}
