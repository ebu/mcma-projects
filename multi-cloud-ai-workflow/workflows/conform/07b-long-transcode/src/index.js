// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));
}