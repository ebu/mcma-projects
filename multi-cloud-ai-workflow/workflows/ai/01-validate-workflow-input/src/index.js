//"use strict";
const AWS = require("aws-sdk");
const { EnvironmentVariableProvider } = require("@mcma/core");
const { ResourceManager, AuthProvider } = require("@mcma/client");
require("@mcma/aws-client");

// Environment Variable(AWS Lambda)
const WebsiteBucket = process.env.WebsiteBucket;

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = new ResourceManager(environmentVariableProvider.getResourceManagerConfig(), new AuthProvider().addAwsV4Auth(AWS));

/* Expecting input like the following:

{
    "input": {
        "bmContent": https://urlToBmContent,
        "bmEssence": https://urlToBmEssence
    },
    "notificationEndpoint": {
        "@type": "NotificationEndpoint",
        "httpEndpoint": "http://workflow-service/job-assignments/34543-34-534345-34/notifications"
    }
}

Note that the notification endpoint is optional. But is used to notify progress and completed/failed of workflow.

*/


/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 0;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification", error);
    }

    // check the input and return mediaFileLocator which service as input for the AI workflows
    if (!event || !event.input) {
        throw new Error("Missing workflow input");
    }

    let input = event.input;

    if (!input.bmContent) {
        throw new Error("Missing input.bmContent");
    }

    if (!input.bmEssence) {
        throw new Error("Missing input.bmEssence");
    }

    let bmContent = await resourceManager.resolve(input.bmContent);
    let bmEssence = await resourceManager.resolve(input.bmEssence);

    console.log(JSON.stringify(bmContent, null, 2), JSON.stringify(bmEssence, null, 2));

    let mediaFileLocator;

    // find the media locator in the website bucket with public httpEndpoint
    for (const locator of bmEssence.locations) {
        if (locator.awsS3Bucket === WebsiteBucket) {
            mediaFileLocator = locator;
        } 
    }

    if (!mediaFileLocator) {
        throw new Error("No suitable Locator found on bmEssence");
    }

    if (!mediaFileLocator.httpEndpoint) {
        throw new Error("Media file Locator does not have an httpEndpoint");
    }

    return mediaFileLocator;
}
