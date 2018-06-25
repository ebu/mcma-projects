// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

// mcma-core settings
core.setServiceRegistryServicesURL(SERVICE_REGISTRY_URL + "/Service");


function createBMEssenceShell(label, locator) {
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

function getBMEssence(jsonObj) {
    var context = jsonObj["@context"]
    var graph = jsonObj["@graph"]
    var bme = graph.find(function(g) { return g['@type'] == 'ebucore:BMEssence' });
    if (bme === null || bme === undefined) {
        console.error("No BMEssence found");
    }
    delete bme['@id'];
    delete bme['ebucore:hasPart'];
    bme["@type"] = "ebucore:BMEssence";
    bme["@context"] = context;
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
        //  (callback) => { // retrieving ame job
        //     var ameJobID = event.workflow_param.amejob_id;
        //     console.log("AmeJob ID = ", ameJobID);
        //     return core.httpGet(ameJobID, callback);
        //  },
        //  (ameJob, callback) => { // retrieving output file
        //     console.log("AmeJob:");
        //     console.log(JSON.stringify(ameJob, null, 2));
        //     return callback(null, ameJob.jobOutput["mcma:outputFile"]);
        //  },
        //  (outputFile, callback) => { // retrieving media info object
        //     // Get Jsonld File From S3 Bucket
        //     console.log("Calling S3.getObject on params above");
        //     var params = {
        //         Bucket: outputFile.awsS3Bucket,
        //         Key: outputFile.awsS3Key
        //     };
        //     s3.getObject(params, function (err, data) {
        //         // Handle any error and exit
        //         if (err) {
        //             return callback(err, null);
        //         } else {
        //             var jsonld = JSON.parse(new Buffer(data.Body).toString("utf8"));
        //             return callback(null, jsonld, outputFile);
        //         }
        //     });
        //  },
        //  (ameData, outputFile, callback) => { // posting ebucore BMEssence
        //     var bme = getBMEssence(event.payload);
        //     console.log("AmeData:", JSON.stringify(ameData, null, 2));
        //     for (var key in ameData) {
        //         if (key != '@context' && ameData.hasOwnProperty(key)) {
        //             bme[key] = ameData[key];
        //         }
        //     }
        //     bme["ebucore:locator"] = "https://" + outputFile.awsS3Bucket + ".s3.amazonaws.com/" + outputFile.awsS3Key;
        //     return core.postResource("ebucore:BMEssence", bme, callback)
        //  },
        //  (bmEssence, callback) => {
        //     console.log("CreatedEssence:", JSON.stringify(bmEssence, null, 2));
        //     var essenceId = bmEssence.id; // not createdObject['@id'] ???
        //     console.log("CreatedEssenceId:", essenceId);
        //     callback(null, essenceId);
        //  },
        //  (essenceId, callback) => {
        //     console.log("CreatedEssence:", JSON.stringify(bmEssence, null, 2));
        //     var essenceId = bmEssence.id; // not createdObject['@id'] ???
        //     console.log("CreatedEssenceId:", essenceId);
        //     callback(null, essenceId);
        //  },
        (callback) => { // Get the ame transform job from the id
            callback();

            // TestCode
            // var id = event.workflow.ids.amejob.asset_id;
            // console.log("AmeJob ID = ", id);
            // return core.httpGet(id, callback);
        },
        (callback) => { // Get the technical metadata file path the job
            callback();

            // TestCode
            // console.log("AmeJob : ", JSON.stringify(ameJob, null, 2));
            // return callback(null, ameJob.jobOutput["mcma:outputFile"]);
        },
        (callback) => { // Get the technical metadata object from s3 bucket
            callback();

            // TestCode
            // var params = {
            //     Bucket: output.awsS3Bucket,
            //     Key: output.awsS3Key
            // };
            // 
            // return s3.getObject(params, callback);
        },
        (callback) => { // Create the new technical metadata essence(BMEssence)
            callback();

            // TestCode
            // var ameData = JSON.parse(new Buffer(data.Body).toString("utf-8"));
            // console.log("AmdData: ", JSON.stringify(ameData));
            // var bme = getBMEssence(event.payload);
            // for (var key in ameData) {
            //     if (key != '@context' && ameData.hasOwnProperty(key)) {
            //         bme[key] = ameData[key];
            //     }
            // }
            // bme["ebucore:locator"] = "https://" + workflow_param.essenceLocator.awsS3Bucket + ".s3.amazonaws.com/" + workflow_param.essenceLocator.awsS3Key;
            // return callback(null, bme);

        },
        (callback) => { // Post the new technical metadata essence(BMEssence)
            callback();

            // TestCode
            // return core.postResource("ebucore:BMEssence", bme, callback);
        },
        (callback) => { // Get BMEssenceID from posting response
            callback();

            // TestCode
            // console.log("Create BMEssence:", JSON.stringify(bme, null, 2));
            // ameId = bmEssence.id;
            // console.log("CreatedEssenceId = ", ameId);
            // return callback(null, ameId);
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
