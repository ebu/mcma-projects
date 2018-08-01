//"use strict";

const util = require("util");
const uuidv4 = require('uuid/v4');

const AWS = require("aws-sdk");
const S3 = new AWS.S3()
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    
}