//"use strict";

const MCMA_CORE = require("mcma-core");

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    event.status = "FAILED";
    try {
        event.statusMessage = JSON.parse(event.error.Cause).errorMessage;
    } catch (error) {
        event.statusMessage = "Unknown. Failed to parse error message";
    }

    let resourceManager = new MCMA_CORE.ResourceManager();

    try {
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
}
