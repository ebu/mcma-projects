//"use strict";

// require
const AWS = require("aws-sdk");
const MCMA_CORE = require("mcma-core");

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

/**
 * Create New BMContent Object
 * @param {*} title title
 * @param {*} description description
 */
function createBMContent(title, description) {
    // init bmcontent
    let bmContent = new MCMA_CORE.BMContent({
        "name": title,
        "description": description,
        "bmEssences": [],
        "awsAiMetadata": null,
        "azureAiMetadata": null,
    });
    return bmContent;
}

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
        event.progress = 18;
        await resourceManager.sendNotification(event);
    } catch (error) {
        console.warn("Failed to send notification");
    }

    // metadata of lambda input parameter
    let metadata = event.input.metadata;

    // create bm content object
    let bmc = createBMContent(metadata.name, metadata.description);

    // post bm content
    bmc = await resourceManager.create(bmc);

    // check if BMContent is registered
    if (!bmc.id) {
        throw new Error("Failed to register BMContent.");
    }

    // return the URL to the BMContent
    return bmc.id;

}