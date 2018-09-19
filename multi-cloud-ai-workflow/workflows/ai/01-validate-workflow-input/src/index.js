//"use strict";

// require
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const REPOSITORY_BUCKET = process.env.REPOSITORY_BUCKET;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

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

    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

    // send update notification
    try {
        event.status = "RUNNING";
        event.progress = 0;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
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

    let bmContent = await retrieveResource(input.bmContent, "input.bmContent");
    let bmEssence = await retrieveResource(input.bmEssence, "input.bmEssence");

    console.log(JSON.stringify(bmContent, null, 2), JSON.stringify(bmEssence, null, 2));

    let mediaFileLocator;

    // find the media locator in the website bucket with public httpEndpoint
    for (const locator of bmEssence.locations) {
        if (locator.awsS3Bucket === WEBSITE_BUCKET) {
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

const retrieveResource = async (resource, resourceName) => {
    let type = typeof resource;

    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    if (type === "string") {  // if type is a string we assume it's a URL.
        try {
            let response = await MCMA_CORE.HTTP.get(resource);
            resource = response.data;
        } catch (error) {
            throw new Error("Failed to retrieve '" + resourceName + "' from url '" + resource + "'");
        }
    }

    type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
}
