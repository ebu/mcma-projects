//"use strict";

// require
const AWS = require("aws-sdk");
const MCMA_CORE = require("mcma-core");

// Environment Variable(AWS Lambda)
const REPOSITORY_BUCKET = process.env.REPOSITORY_BUCKET;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
const WEBSITE_BUCKET = process.env.WEBSITE_BUCKET;

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    sessionToken: AWS.config.credentials.sessionToken,
    region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const resourceManager = new MCMA_CORE.ResourceManager({
    servicesUrl: process.env.SERVICES_URL,
    servicesAuthType: process.env.SERVICES_AUTH_TYPE,
    servicesAuthContext: process.env.SERVICES_AUTH_CONTEXT,
    authProvider
});


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

    let bmContent = await resourceManager.resolve(input.bmContent);
    let bmEssence = await resourceManager.resolve(input.bmEssence);

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
