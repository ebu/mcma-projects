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
        (callback) => { // Get the technical metadata(BMEssence)
            callback(null, duration);
        },
        (duration, callback) => { // Add transcode type to workflow parameter
            // Check mediainfo duration(ebucore:duration)
            event.workflow_param.transcode = duration > 15 ? "long" : "short";
            callback();
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
