//"use strict";

const MCMA_CORE = require("mcma-core");

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

/**
 * Create New BMContent Object
 * @param {*} title 
 * @param {*} description 
 */
function createBMContent(title, description) {
    let bmContent = {
        "@type": "BMContent",
        "ebucore:title": title,
        "ebucore:description": description,
        // "rdfs:label": "Eurovision Song Contest 2015, Austria",
        // "ebucore:dateCreated": "2015-05-23T21:00:00",
        // "ebucore:dateModified": "2015-05-23T21:00:00",
        // "ebucore:title": "Eurovision Song Contest 2015 Grand Final",
        // "esc:orderOk": "1",
        // "esc:resultsKnown": "1",
        // "esc:votingRules": " Televoters and a professional jury in each country have a 50% stake in the outcome. The votes are revealed by spokespeople from all participating countries. ",
        // "ebucore:date": "2015-05-23T21:00:00",
        // "@context": {
        //     "ebucore": "http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#",
        //     "esc": "http://www.eurovision.com#",
        //     "fims": "http://fims.tv#",
        //     "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        //     "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        //     "xsd": "http://www.w3.org/2001/XMLSchema#"
        // }
    };

    return bmContent;
}

/**
 * Lambda function handler
 * @param {*} event 
 * @param {*} context 
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    // init resource manager
    let resourceManager = new MCMA_CORE.ResourceManager(SERVICE_REGISTRY_URL);

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

    if (!bmc.id) {
        throw new Error("Failed to register BMContent.");
    }

    return bmc.id;

}