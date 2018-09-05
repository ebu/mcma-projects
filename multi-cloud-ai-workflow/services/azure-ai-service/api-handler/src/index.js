//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const Lambda = new AWS.Lambda({ apiVersion: "2015-03-31" });
const LambdaInvoke = util.promisify(Lambda.invoke.bind(Lambda));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");
const uuidv4 = require('uuid/v4');


let AzureApiUrl; //= "https://api.videoindexer.ai"  // need to move to a stage variale 
let AzureLocation; 
let AzureAccountID; 
let AzureSubscriptionKey;

// async functions to handle the different routes.
const getJobAssignments = async (request, response) => {
    console.log("getJobAssignments()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    response.body = await table.getAll("JobAssignment");

    console.log(JSON.stringify(response, null, 2));
}

const deleteJobAssignments = async (request, response) => {
    console.log("deleteJobAssignments()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignments = await table.getAll("JobAssignment");

    for (let i = 0; i < jobAssignments.length; i++) {
        await table.delete("JobAssignment", jobAssignments[i].id);
    }

    console.log(JSON.stringify(response, null, 2));
}

const addJobAssignment = async (request, response) => {
    console.log("addJobAssignment()", JSON.stringify(request, null, 2));

    let jobAssignment = request.body;
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing request body.";
        return;
    }

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + uuidv4();
    if (jobAssignment["@type"] !== "JobAssignment") {
        jobAssignment["@type"] = "JobAssignment";
    }
    jobAssignment.id = jobAssignmentId;
    jobAssignment.status = "NEW";
    jobAssignment.dateCreated = new Date().toISOString();
    jobAssignment.dateModified = jobAssignment.dateCreated;

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    response.statusCode = MCMA_AWS.HTTP_CREATED;
    response.headers.Location = jobAssignment.id;
    response.body = jobAssignment;

    console.log(JSON.stringify(response, null, 2));

    // invoking worker lambda function that will process the job assignment
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "action": "ProcessJobAssignment", "request": request, "jobAssignmentId": jobAssignmentId })
    };

    await LambdaInvoke(params);
}

const getJobAssignment = async (request, response) => {
    console.log("getJobAssignment()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + request.path;

    response.body = await table.get("JobAssignment", jobAssignmentId);

    if (response.body === null) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
    }
}

const deleteJobAssignment = async (request, response) => {
    console.log("deleteJobAssignment()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + request.path;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    await table.delete("JobAssignment", jobAssignmentId);
}

const processNotification = async (request, response) => {
    console.log("processNotification()", JSON.stringify(request, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + request.pathVariables.id;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    let notification = request.body;

    if (!notification) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification in request body";
        return;
    }

    // invoking worker lambda function that will process the notification
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "action": "ProcessNotification", "request": request, "jobAssignmentId": jobAssignmentId, "notification": notification })
    };

    await LambdaInvoke(params);
}


const processNotificationFromAzure = async (request, response) => {
    console.log("UpdateJobAssignmentFromAzure()", JSON.stringify(request, null, 2));


    let table = new MCMA_AWS.DynamoDbTable(AWS, request.stageVariables.TableName);

    let jobAssignmentId = request.stageVariables.PublicUrl + "/job-assignments/" + request.pathVariables.id;

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);

    console.log("jobAssignment = ", jobAssignment);

    if (!jobAssignment) {
        console.log("jobAssignment not found", jobAssignment);
        response.statusCode = MCMA_AWS.HTTP_NOT_FOUND;
        response.statusMessage = "No resource found on path '" + request.path + "'.";
        return;
    }

    let notification = request.queryStringParameters;
    console.log("notification = ", notification);
    if (!notification) {
        response.statusCode = MCMA_AWS.HTTP_BAD_REQUEST;
        response.statusMessage = "Missing notification in request Query String";
        return;
    }

    // invoking worker lambda function that will process the notification
    var params = {
        FunctionName: request.stageVariables.WorkerLambdaFunctionName,
        InvocationType: "Event",
        LogType: "None",
        Payload: JSON.stringify({ "action": "ProcessNotification", "request": request, "jobAssignmentId": jobAssignmentId, "notification": notification })
    };

   console.log("Invoking Lambda : ",params  );

    await LambdaInvoke(params);



// *****************************************************

    // Check if the response contain information from Azure
    // 

 /*    let jobAssignmentId = request.stageVariables.PublicUrl + request.path; 


    let flagCounter = 0;
    let azureVideoId;
    let azureState;
    if (request.queryStringParameters) {

        if (request.queryStringParameters.id) {
            flagCounter++;
            azureVideoId = request.queryStringParameters.id;
        }

        if (request.queryStringParameters.state) {
            flagCounter++;
            azureState = request.queryStringParameters.state
        }
    }

    if (flagCounter != 2) {
        console.error("looks like the POST is not coming from Azure Video Indexer: expecting two parameters id and state");
    } else {

        // Get the AI metadata form Azure for the video
        console.log("The POST is coming from Azure. Next steps, get the metadata for the video  ");


        let authTokenUrl = AzureApiUrl + "/auth/" + AzureLocation + "/Accounts/" + AzureAccountID + "/AccessToken?allowEdit=true";
        let customHeaders = { 'Ocp-Apim-Subscription-Key': AzureSubscriptionKey };
        let apiToken;


        console.log("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);
        let response = await MCMA_CORE.HTTP.get(authTokenUrl, {
            headers: { 'Ocp-Apim-Subscription-Key': AzureSubscriptionKey }
        });

        console.log("Azure API Token response : ", response);

        if (response.status != 200) {
            console.console.error("Error generating an Azure Auth Token : ", response);
        }
        else {
            apiToken = response.data;
            console.log("Azure API Token : ", apiToken);


        //https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos/{videoId}/Index[?accessToken][&language]   
        let videoMetadata;
        let metadataFromAzureVideoIndexwer = AzureApiUrl + "/" + AzureLocation + "/Accounts/" + AzureAccountID + "/Videos/" + azureVideoId + "/Index?accessToken=" + apiToken + "&language=English";
           
                console.log("Get the azure video metadata : Doing a GET on  : ", metadataFromAzureVideoIndexwer);
                let indexedVideoMetadataResponse = await MCMA_CORE.HTTP.get(metadataFromAzureVideoIndexwer);

                console.log("Azure Indexed Video Metadata get response : ", indexedVideoMetadataResponse);

                if (indexedVideoMetadataResponse.status != 200) {
                    console.console.error("Error getting Azure video metadata : ", indexedVideoMetadataResponse);
                }
                else {
                    videoMetadata = indexedVideoMetadataResponse.data;
                    console.log("Azure AI video metadata : ", videoMetadata);

                    // get the info about the destination bucket to store the result of the 
                    let s3Params = {
                        Bucket: outputLocation.awsS3Bucket,
                        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
                        Body: videoMetadata
                    }
            
                    await S3PutObject(s3Params);
            
                    //updating JobAssignment with jobOutput
                    let jobOutput = new MCMA_CORE.JobParameterBag({
                        outputFile: new MCMA_CORE.Locator({
                            awsS3Bucket: s3Params.Bucket,
                            awsS3Key: s3Params.Key
                        })
                    });

                    await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

                    // 10. Setting job assignment status to COMPLETED
                    await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");

                }
            }
        

    } */



    

}


// Initializing rest controller for API Gateway Endpoint
const restController = new MCMA_AWS.ApiGatewayRestController();

// adding routes for GET, POST and DELETE
restController.addRoute("GET", "/job-assignments", getJobAssignments);
restController.addRoute("POST", "/job-assignments", addJobAssignment);
restController.addRoute("DELETE", "/job-assignments", deleteJobAssignments);
restController.addRoute("GET", "/job-assignments/{id}", getJobAssignment);
restController.addRoute("DELETE", "/job-assignments/{id}", deleteJobAssignment);
restController.addRoute("POST", "/job-assignments/{id}", processNotificationFromAzure); // to Handle notification coming back from Azure

// adding route for notifications from workflow
restController.addRoute("POST", "/job-assignments/{id}/notifications", processNotification);

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    AzureApiUrl = event.stageVariables.AzureApiUrl; // "https://api.videoindexer.ai"   
    AzureLocation =  event.stageVariables.AzureLocation;
    AzureAccountID =  event.stageVariables.AzureAccountID;
    AzureSubscriptionKey =  event.stageVariables.AzureSubscriptionKey;



    return await restController.handleRequest(event, context);
}
