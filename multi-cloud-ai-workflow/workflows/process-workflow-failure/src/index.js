//"use strict";
const AWS = require("aws-sdk");
const { EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));

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
