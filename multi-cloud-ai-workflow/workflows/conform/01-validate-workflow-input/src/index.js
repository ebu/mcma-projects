// require
const AWS = require("aws-sdk");
const async = require("async");
const _ = require('underscore');
// get reference to S3 client
var s3 = new AWS.S3();

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 * @param {*} callback callback
 */
exports.handler = (event, context, callback) => {
    console.log("S3 api version = " + s3.apiVersion);
    // Read options from the event.
    console.log("event:", JSON.stringify(event));
    // Read bucket name
    var srcBucket = event.Records[0].s3.bucket.name;
    console.log("bucket name = " + srcBucket);
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    console.log("object key = " + srcKey);
    // Execute async waterfall
    async.waterfall([
        (callback) => {
            // Get Jsonld File From S3 Bucket
            console.log("Calling S3.getObject on params above");
            var params = {
                Bucket: srcBucket,
                Key: srcKey
            };
            s3.getObject(params, function (err, data) {
                // Handle any error and exit
                if (err) {
                    return callback(err, null);
                } else {
                    var jsonld = JSON.parse(new Buffer(data.Body).toString("utf8"));
                    return callback(null, jsonld);
                }
            });
        },
        (jsonld, callback) => {
            // Validate Title(ebucore:title)
            console.log("Validate Title(ebucore:title).");
            var title = getElementValue(jsonld, "ebucore:title");

            if (title.length == 0 || title[0].length == 0) {
                return callback("Not Found Title(ebucore:title).");
            }

            console.log("[ebucore:title]:", title[0]);
            callback(null, jsonld, title[0]);
        },
        (jsonld, title, callback) => {
            // Validate Description(ebucore:description)
            console.log("Validate Description(ebucore:description).");
            var description = getElementValue(jsonld, "ebucore:description");

            if (description.length == 0 || description[0].length == 0) {
                return callback("Not Found Title(ebucore:title).");
            }

            console.log("[ebucore:description]:", description[0]);
            callback(null, jsonld, title, description);
        },
        (jsonld, title, description, callback) => {
            // Validate Media File Location(ebucore:fileName)
            console.log("Validate Media File Location(ebucore:fileName).");
            var fileName = getElementValue(jsonld, "ebucore:fileName");
            console.log("[ebucore:fileName]:", fileName[0]);
            callback(null, jsonld, fileName[0]);
        },
        (jsonld, fileName, callback) => {
            // Check Exist Video File(S3Bucket)
            console.log("Check Exist Video File(S3Bucket).");
            var params = {
                Bucket: srcBucket,
                Key: fileName
            };
            s3.getObject(params, function (err, data) {
                // Handle any error and exit
                if (err) {
                    return callback("Not Found Video File:" + fileName);
                } else {
                    return callback(null, jsonld, fileName);
                }
            });
        },
        (jsonld, fileName, callback) => {
            // Create results Object
            var result = {
                "workflow_param" : {
                    "src_bucket" : srcBucket,
                    "src_key" : srcKey,
                    "essence" : fileName,
                },
                "payload" : jsonld,
            };
            callback(null, result);
        }
    ], (err, result) => {
        // Process results
        if (err) {
            console.error(err);
        }
        callback(err, result);
    });
};

/**
 * Retrieve the value of the specified element
 * @param {*} jsonld Metadata Json
 * @param {*} propertyName Target Element Name
 */
function getElementValue(jsonld, propertyName) {
    var graph = jsonld["@graph"];
    var pluck = _.pluck(graph, propertyName);
    var value = pluck.filter(function (element) {
        return !!element;
    });
    return value;
}
