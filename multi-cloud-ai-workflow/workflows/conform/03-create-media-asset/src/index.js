//"use strict";

const { EnvironmentVariableProvider, BMContent } = require("mcma-core");
const { getAwsV4ResourceManager } = require("mcma-aws");

const environmentVariableProvider = new EnvironmentVariableProvider();
const resourceManager = getAwsV4ResourceManager(environmentVariableProvider);

/**
 * Create New BMContent Object
 * @param {*} title title
 * @param {*} description description
 */
function createBMContent(title, description) {
    // init bmcontent
    let bmContent = new BMContent({
        name: title,
        description: description,
        bmEssences: [],
        awsAiMetadata: null,
        azureAiMetadata: null,
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
        console.warn("Failed to send notification", error);
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