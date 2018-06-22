// require
const AWS = require("aws-sdk");
const async = require("async");

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
        (callback) => { // Get Activity Task from Step Functions
            callback();
        },
        (callback) => { // Get JobProfiles by label
            callback();
        },
        (callback) => { // Create the new TransformJob, and Post TransformJob
            callback();
        },
        (callback) => { // Create the job process of ame job, and Post JobProcess
            callback();
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
