//"use strict";

const AWS = require("aws-sdk");
const MCMA_AWS = require("mcma-aws");
const uuidv4 = require('uuid/v4');

// async functions to handle the different routes.

const getServices = async (request, response) => {
    console.log("getServices()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("Service");

    console.log(JSON.stringify(response, null, 2));
}

const addService = async (request, response) => {
    console.log("addService()", JSON.stringify(request, null, 2));

    let service = request.body;
    if (!service) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let serviceId = request.stageVariables.PublicUrl + "/services/" + uuidv4();
    if (service["@type"] !== "Service") {
        service["@type"] = "Service";
    }
    service.id = serviceId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("Service", serviceId, service);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = service.id;
    response.body = service;

    console.log(JSON.stringify(response, null, 2));
}

const getService = async (request, response) => {
    console.log("getService()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let serviceId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("Service", serviceId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const putService = async (request, response) => {
    console.log("putService()", JSON.stringify(request, null, 2));

    let service = request.body;
    if (!service) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let serviceId = request.stageVariables.PublicUrl + request.path;
    if (service["@type"] !== "Service") {
        service["@type"] = "Service";
    }
    service.id = serviceId;

    await table.put("Service", serviceId, service);

    response.body = service;
}

const deleteService = async (request, response) => {
    console.log("deleteService()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let serviceId = request.stageVariables.PublicUrl + request.path;

    let service = await table.get("Service", serviceId);
    if (!service) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("Service", serviceId);
}

const getJobProfiles = async (request, response) => {
    console.log("getJobProfiles()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobProfile");

    console.log(JSON.stringify(response, null, 2));
}

const addJobProfile = async (request, response) => {
    console.log("addJobProfile()", JSON.stringify(request, null, 2));

    let jobProfile = request.body;
    if (!jobProfile) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobProfileId = request.stageVariables.PublicUrl + "/job-profiles/" + uuidv4();
    if (jobProfile["@type"] !== "JobProfile") {
        jobProfile["@type"] = "JobProfile";
    }
    jobProfile.id = jobProfileId;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobProfile", jobProfileId, jobProfile);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobProfile.id;
    response.body = jobProfile;

    console.log(JSON.stringify(response, null, 2));
}

const getJobProfile = async (request, response) => {
    console.log("getJobProfile()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProfileId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("JobProfile", jobProfileId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const putJobProfile = async (request, response) => {
    console.log("putJobProfile()", JSON.stringify(request, null, 2));

    let jobProfile = request.body;
    if (!jobProfile) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProfileId = request.stageVariables.PublicUrl + request.path;
    if (jobProfile["@type"] !== "JobProfile") {
        jobProfile["@type"] = "JobProfile";
    }
    jobProfile.id = jobProfileId;

    await table.put("JobProfile", jobProfileId, jobProfile);

    response.body = jobProfile;
}

const deleteJobProfile = async (request, response) => {
    console.log("deleteJobProfile()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobProfileId = request.stageVariables.PublicUrl + request.path;

    let jobProfile = await table.get("JobProfile", jobProfileId);
    if (!jobProfile) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("JobProfile", jobProfileId);
}

// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.RestController();

// adding routes
restController.addRoute("GET", "/services", getServices);
restController.addRoute("POST", "/services", addService);
restController.addRoute("GET", "/services/{id}", getService);
restController.addRoute("PUT", "/services/{id}", putService);
restController.addRoute("DELETE", "/services/{id}", deleteService);

restController.addRoute("GET", "/job-profiles", getJobProfiles);
restController.addRoute("POST", "/job-profiles", addJobProfile);
restController.addRoute("GET", "/job-profiles/{id}", getJobProfile);
restController.addRoute("PUT", "/job-profiles/{id}", putJobProfile);
restController.addRoute("DELETE", "/job-profiles/{id}", deleteJobProfile);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    return await restController.handleRequest(event, context);
}
