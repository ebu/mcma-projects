//"use strict";

const { EnvironmentVariableProvider } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    event.status = "FAILED";
    try {
        event.statusMessage = JSON.parse(event.error.Cause).errorMessage;
    } catch (error) {
        event.statusMessage = "Unknown. Failed to parse error message";
    }

    try {
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }
}
