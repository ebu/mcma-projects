//"use strict";

const AWS = require("aws-sdk");
const MCMA_AWS = require("mcma-aws");
const stepfunctions = new AWS.StepFunctions();

// async functions to handle the different routes.

const processNotification = async (request, response) => {
    console.log("processNotification()", JSON.stringify(request, null, 2));

    //TODO get task token from query string parameters
    //TODO process content status (which is a job) to see if it has 'COMPLETED' or 'FAILED' and stop the activity appropriately
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("POST", "/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
