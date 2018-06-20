// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

// mcma-core settings
core.setServiceRegistryServicesURL(SERVICE_REGISTRY_URL + "/Service");

/**
 * Retreving BMContent with metadata
 * @param {*} json BMContent with metadata
 */
function getBMContent(json) {
    // Retrieve the value of the specified element(@type = ebucore:BMContent)
    var graph = json["@graph"];
    var bmc = graph.find(function(bm) { return bm['@type'] == 'ebucore:BMContent' });
    if (bmc === null || bmc === undefined) {
        return null;
    }
    // Delete unnecessary properties
    delete bmc['@id'];
    delete bmc["ebucore:hasPart"];
    // Set new properties
    bmc['@type'] = "BMContent";
    bmc["@context"] = json["@context"];

    return bmc;
}

/**
 * Retreving BMEssence with metadata
 * @param {*} json BMEssence with metadata
 */
function getBMEssence(json) {
    // Retrieve the value of the specified element(@type = ebucore:BMEssence)
    var graph = json["@graph"]
    var bme = graph.find(function(g) { return g['@type'] == 'ebucore:BMEssence' });
    if (bme === null || bme === undefined) {
        return null;
    }
    // Delete unnecessary properties
    delete bme['@id'];
    delete bme['ebucore:hasPart'];
    // Set new properties
    bme["@type"] = "ebucore:BMEssence";
    bme["@context"] = json["@context"];

    return bme;
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 * @param {*} callback callback
 */
exports.handler = (event, context, callback) => {
    // Read options from the event.
    console.log("Event:");
    console.log(JSON.stringify(event, null, 2));
    // Execute async waterfall
    async.waterfall([
        (callback) => { // Create the metadata content(BMContent)
            var bmc = getBMContent(event.payload);
            // Check the value of the BMContent
            if( bmc === null) {
                return callback("Not Found BMContent with metadata.");
            }
            return callback(null, bmc);
        },
        (bmc, callback) => { // Post the metadata content(BMContent)
            console.log("Posting BMContent:");
            core.postResource("ebucore:BMContent", bmc, callback);
        },
        (bmContent, callback) => { // Add BMContent ID to workflow parameter
            console.log("Created BMContent:");
            console.log(JSON.stringify(bmContent, null, 2));
            var bmContentID = bmContent.id;
            console.log("Created BMContentId:", bmContentID);
            event.workflow_param.assetID = bmContentID
            return callback();
        }
    ], (err) => {
        // Process results
        if (err) {
            console.error("Error:");
            console.error(err);
        }
        return callback(err, event);
    });
}
