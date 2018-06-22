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
        (callback) => { // Get the proxy transform job from the id
            callback();
        },
        (callback) => { // extract the created proxy file path from the job
            callback();
        },
        (callback) => { // create the new essence and post it to the media repo
            callback();
        },
        (callback) => { // Post the new proxy essence(BMEssence)
            callback();
        },
        (callback) => { // Get BMEssenceID from posting response
            callback();
        },
        (callback) => { // Get the latest version of BMContent from id
            callback();
        },
        (callback) => { // Add Technical metadata to BMEsssence
            callback();
        },
        (callback) => { // Add proxy essence to BMContent, And Put BMContent
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
