// require
const AWS = require("aws-sdk")
const async = require("async");
// get reference to S3 client
var s3 = new AWS.S3();

/**
 * Lambda function handler
 * @param {*} event
 * @param {*} context
 * @param {*} callback
 */
exports.handler = (event, context, callback) => {
    console.log("Hello, Lambda!");
    console.log("S3 api version = " + s3.apiVersion);

    async.waterfall([
        (callback) => {
            console.log("inside waterfall");

            callback();
        }
    ], () => {
        console.log("left the waterfall. exiting lambda...")
        callback();
    });
}
