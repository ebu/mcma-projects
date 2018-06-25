// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

function CreateBMEssenceShell(label, locator) {
    var bmeShell = {
        "@context": {
            "ebucore": "http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#",
            "esc": "http://www.eurovision.com#",
            "fims": "http://fims.tv#",
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "xsd": "http://www.w3.org/2001/XMLSchema#"
        },
        "rdfs:label": label,
        "ebucore:locator": locator,
        "@type": "ebucore:BMEssence"
    }
    return bmeShell;
}

function AddEssencetoBMContent(bmc, resourceId) {
    if (resourceId) {
        // add the essence
        if (bmc["ebucore:hasRelatedResource"] == undefined) {
            bmc["ebucore:hasRelatedResource"] = [];
        }
        else {
            if (Array.isArray(bmc["ebucore:hasRelatedResource"]) == false) {
                if (bmc["ebucore:hasRelatedResource"].id == undefined) {
                    bmc["ebucore:hasRelatedResource"] = [];
                }
                else {
                    var tempValue = bmc["ebucore:hasRelatedResource"].id;
                    bmc["ebucore:hasRelatedResource"] = [];
                    bmc["ebucore:hasRelatedResource"].push({ "id": tempValue });
                }
            }

        }

        bmc["ebucore:hasRelatedResource"].push({ "@id": "" + resourceId + "" });
    }
    return bmc;
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

    var proxyId = null;

    // Execute async waterfall
    async.waterfall([
        (callback) => { // Get the proxy transform job from the id
            callback();

            // TestCode
            // var id = event.workflow.ids.transformjob.createproxy_id;
            // console.log("TransformJob(proxy) ID = ", id);
            // return core.httpGet(id, callback);
        },
        (callback) => { // extract the created proxy file path from the job
            callback();

            // TestCode
            // console.log("TransformJob(proxy):", JSON.stringify(proxyJob, null, 2));
            // return callback(null, proxyJob.jobOutput["mcma:outputFile"]);
        },
        (callback) => { // create the new essence and post it to the media repo
            callback();

            // TestCode
            // var locator = "http://" + output.awsS3Bucket + ".s3.amazonaws.com/" + output.awsS3Key;
            // return callback(null, locator);
        },
        (callback) => { // Post the new proxy essence(BMEssence)
            callback();

            // TestCode
            // var bme = CreateBMEssenceShell("proxy", locator);
            // return core.postResource("ebucore:BMEssence", bme, callback);

        },
        (callback) => { // Get BMEssenceID from posting response
            callback();

            // TestCode
            // console.log("Create BMEssence:", JSON.stringify(bme, null, 2));
            // proxyId = bmEssence.id;
            // console.log("CreatedEssenceId = ", proxyId);
            // return callback(null, proxyId);
        },
        (callback) => { // Get the latest version of BMContent from id
            callback();

            // TestCode
            // var id = workflow.ids.amejob.asset_id;
            // console.log("Get Latest version of BMContent:", id);
            // core.httpGet(id, callback);
        },
        (callback) => { // Add Technical metadata to BMEsssence
            callback();

            // TestCode
            // console.log("The Latest Version of BMContent:", JSON.stringify(bmc, null, 2));
            // var updatedBmc = AddEssencetoBMContent(bmc, proxyId);
            // callback(null, bmc, updatedBmc);
        },
        (callback) => { // Add proxy essence to BMContent, And Put BMContent
            callback();

            // TestCode
            // return core.httpPut(bmc.id, updatedBmc);
        },
        (callback) => { // Add proxy essence to BMContent, And Put BMContent
            callback();

            // TestCode
            // console.log("Updated BMContent:", JSON.stringify(bmContent, null, 2));
            // return callback();
        }
    ], (err) => {
        // Process results
        if (err) {
            console.error("Error:");
            console.error(err);
        }
        callback(err, event);
    });
}
