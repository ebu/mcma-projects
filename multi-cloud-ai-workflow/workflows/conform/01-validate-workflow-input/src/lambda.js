
const AWS = require("aws-sdk")
const async = require("async");

var s3 = new AWS.S3();

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
