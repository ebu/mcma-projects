//"use strict";

const AWS = require("aws-sdk");
const MCMA_CORE = require("mcma-core");

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

const authenticator = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
	sessionToken: AWS.config.credentials.sessionToken,
	region: AWS.config.region
});

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL, authenticator);

    // send update notification
    try {
        event.status = "COMPLETED";
        event.progress = 100;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }
}
