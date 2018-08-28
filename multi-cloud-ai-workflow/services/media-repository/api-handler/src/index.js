//"use strict";

const AWS = require("aws-sdk");
const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

const getBMContents = async (request, response) => {
    console.log("getBMContents()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("BMContent");

    console.log(JSON.stringify(response, null, 2));
}

const addBMContent = async (request, response) => {
    console.log("addBMContent()", JSON.stringify(request, null, 2));

    let bmContent = request.body;
    if (!bmContent) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let bmContentId = request.stageVariables.PublicUrl + "/bm-contents/" + uuidv4();
    if (bmContent["@type"] !== "BMContent") {
        bmContent["@type"] = "BMContent";
    }
    bmContent.id = bmContentId;
    bmContent.dateCreated = new Date().toISOString();
    bmContent.dateModified = bmContent.dateCreated;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("BMContent", bmContentId, bmContent);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = bmContent.id;
    response.body = bmContent;

    console.log(JSON.stringify(response, null, 2));
}

const getBMContent = async (request, response) => {
    console.log("getBMContent()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmContentId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("BMContent", bmContentId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const putBMContent = async (request, response) => {
    console.log("putBMContent()", JSON.stringify(request, null, 2));

    let bmContent = request.body;
    if (!bmContent) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmContentId = request.stageVariables.PublicUrl + request.path;
    if (bmContent["@type"] !== "BMContent") {
        bmContent["@type"] = "BMContent";
    }
    bmContent.id = bmContentId;
    bmContent.dateModified = new Date().toISOString();
    if (!bmContent.dateCreated) {
        bmContent.dateCreated = bmContent.dateModified;
    }

    await table.put("BMContent", bmContentId, bmContent);

    response.body = bmContent;
}

const deleteBMContent = async (request, response) => {
    console.log("deleteBMContent()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmContentId = request.stageVariables.PublicUrl + request.path;

    let bmContent = await table.get("BMContent", bmContentId);
    if (!bmContent) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("BMContent", bmContentId);
}

const getBMEssences = async (request, response) => {
    console.log("getBMEssences()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("BMEssence");

    console.log(JSON.stringify(response, null, 2));
}

const addBMEssence = async (request, response) => {
    console.log("addBMEssence()", JSON.stringify(request, null, 2));

    let bmEssence = request.body;
    if (!bmEssence) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let bmEssenceId = request.stageVariables.PublicUrl + "/bm-essences/" + uuidv4();
    if (bmEssence["@type"] !== "BMEssence") {
        bmEssence["@type"] = "BMEssence";
    }
    bmEssence.id = bmEssenceId;
    bmEssence.dateCreated = new Date().toISOString();
    bmEssence.dateModified = bmEssence.dateCreated;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("BMEssence", bmEssenceId, bmEssence);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = bmEssence.id;
    response.body = bmEssence;

    console.log(JSON.stringify(response, null, 2));
}

const getBMEssence = async (request, response) => {
    console.log("getBMEssence()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmEssenceId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("BMEssence", bmEssenceId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const putBMEssence = async (request, response) => {
    console.log("putBMEssence()", JSON.stringify(request, null, 2));

    let bmEssence = request.body;
    if (!bmEssence) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmEssenceId = request.stageVariables.PublicUrl + request.path;
    if (bmEssence["@type"] !== "BMEssence") {
        bmEssence["@type"] = "BMEssence";
    }
    bmEssence.id = bmEssenceId;
    bmEssence.dateModified = new Date().toISOString();
    if (!bmEssence.dateCreated) {
        bmEssence.dateCreated = bmEssence.dateModified;
    }

    await table.put("BMEssence", bmEssenceId, bmEssence);

    response.body = bmEssence;
}

const deleteBMEssence = async (request, response) => {
    console.log("deleteBMEssence()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let bmEssenceId = request.stageVariables.PublicUrl + request.path;

    let bmEssence = await table.get("BMEssence", bmEssenceId);
    if (!bmEssence) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("BMEssence", bmEssenceId);
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.ApiGatewayRestController();

// adding routes
restController.addRoute("GET", "/bm-contents", getBMContents);
restController.addRoute("POST", "/bm-contents", addBMContent);
restController.addRoute("GET", "/bm-contents/{id}", getBMContent);
restController.addRoute("PUT", "/bm-contents/{id}", putBMContent);
restController.addRoute("DELETE", "/bm-contents/{id}", deleteBMContent);

restController.addRoute("GET", "/bm-essences", getBMEssences);
restController.addRoute("POST", "/bm-essences", addBMEssence);
restController.addRoute("GET", "/bm-essences/{id}", getBMEssence);
restController.addRoute("PUT", "/bm-essences/{id}", putBMEssence);
restController.addRoute("DELETE", "/bm-essences/{id}", deleteBMEssence);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
