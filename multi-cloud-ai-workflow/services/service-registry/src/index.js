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
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return callback();
}
