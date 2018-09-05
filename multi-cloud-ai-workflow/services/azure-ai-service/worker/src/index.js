//"use strict";

const util = require('util');

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const TranscribeService = new AWS.TranscribeService();
const TranscribeServiceStartTranscriptionJob = util.promisify(TranscribeService.startTranscriptionJob.bind(TranscribeService));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");
const uuidv4 = require('uuid/v4');


const JOB_PROFILE_TRANSCRIBE_AUDIO = "TranscribeAudio";
const JOB_PROFILE_TRANSLATE_TEXT = "TranslateText";
const JOB_PROFILE_EXTRACT_ALL_AI_METADATA = "ExtractAllAIMetadata";

let AzureApiUrl; //= "https://api.videoindexer.ai"  // need to move to a stage variale 
let AzureLocation; 
let AzureAccountID; 
let AzureSubscriptionKey;

// function HttpGetData(url, customHeaders) {
//     // Setting URL and headers for request
//     var options = {
//         url: url,
//         headers: customHeaders

//     };
//     // Return new promise 
//     return new Promise(function (resolve, reject) {
//         // Do async job
//         request.get(options, function (err, resp, body) {
//             if (err) {
//                 reject(err);
//             } else {
//                 resolve(body);
//             }
//         })
//     })  
// }




exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

     AzureApiUrl = event.request.stageVariables.AzureApiUrl; // "https://api.videoindexer.ai"   
     AzureLocation =  event.request.stageVariables.AzureLocation;
     AzureAccountID =  event.request.stageVariables.AzureAccountID;
     AzureSubscriptionKey =  event.request.stageVariables.AzureSubscriptionKey;

  event.request.stageVariables


    switch (event.action) {
        case "ProcessJobAssignment":
            await processJobAssignment(event);
            break;
        case "ProcessNotification":
            await processNotification(event);
            break;
    }
}

const processJobAssignment = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving WorkflowJob
        let workflowJob = await retrieveWorkflowJob(table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(workflowJob);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(workflowJob);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        validateJobProfile(jobProfile, jobInput);

        // 6. start the appropriate ai service
        let inputFile = jobInput.inputFile;
        let outputLocation = jobInput.outputLocation;

        let mediaFileUri;

        if (inputFile.httpEndpoint) {
            mediaFileUri = httpEndpoint;
        } else {
            let data = await S3GetBucketLocation({ Bucket: inputFile.awsS3Bucket });
            console.log(JSON.stringify(data, null, 2));
            mediaFileUri = "https://s3-" + data.LocationConstraint + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
        }

        let params, data;

        switch (jobProfile.name) {
            // case JOB_PROFILE_TRANSCRIBE_AUDIO:
            //     let mediaFormat;

            //     if (mediaFileUri.toLowerCase().endsWith("mp3")) {
            //         mediaFormat = "mp3";
            //     } else if (mediaFileUri.toLowerCase().endsWith("mp4")) {
            //         mediaFormat = "mp4";
            //     } else if (mediaFileUri.toLowerCase().endsWith("wav")) {
            //         mediaFormat = "wav";
            //     } else if (mediaFileUri.toLowerCase().endsWith("flac")) {
            //         mediaFormat = "flac";
            //     } else {
            //         throw new Error("Unable to determine Media Format from input file '" + mediaFileUri + "'");
            //     }

            //     params = {
            //         TranscriptionJobName: jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
            //         LanguageCode: "en-US",
            //         Media: {
            //             MediaFileUri: mediaFileUri
            //         },
            //         MediaFormat: mediaFormat,
            //         OutputBucketName: outputLocation.awsS3Bucket
            //     }

            //     data = await TranscribeServiceStartTranscriptionJob(params);

            //     break;



            case JOB_PROFILE_EXTRACT_ALL_AI_METADATA:
                // implement call to azure

                // Get a token for API call - token are onlu good for one hour
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

                    // call the Azure API to process the video 
                    // in this scenario the video is located in a public link
                    // so no need to upload the file to Azure

                    /*                 Sample URL Structure      
                                       https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos?accessToken={accessToken}&
                                                                                 name={name}?description={string}&
                                                                                partition={string}&
                                                                                externalId={string}&
                                                                                callbackUrl={string}&
                                                                                metadata={string}&
                                                                                language={string}&
                                                                                videoUrl={string}&
                                                                                fileName={string}&
                                                                                indexingPreset={string}&
                                                                                streamingPreset=Default&
                                                                                linguisticModelId={string}&
                                                                                privacy={string}&
                                                                                externalUrl={string}" */

                    let postVideoUrl = AzureApiUrl + "/" + AzureLocation + "/Accounts/" + AzureAccountID + "/Videos?accessToken=" + apiToken + "&name=" + inputFile.awsS3Key + "&callbackUrl=" + jobAssignmentId + "&videoUrl=" + mediaFileUri + "&fileName=" + inputFile.awsS3Key;

                    console.log("Call Azure Video Indexer Video API : Doing a POST on  : ", postVideoUrl);
                    let postVideoResponse = await MCMA_CORE.HTTP.post(postVideoUrl);

                    console.log("Azure API RAW Response postVideoResponse",postVideoResponse);

                    if (postVideoResponse.status != 200) {
                        console.error("Azure Video Indexer - Error processing the video : ", response);
                    }
                    else {
                        let azureAssetInfo =  postVideoResponse.data;
                        console.log("azureAssetInfo: ", JSON.stringify(azureAssetInfo, null, 2) );

                        try {
                               console.log("updateJobAssignmentWithInfo" );
                               console.log("table = ", table );
                               console.log("jobAssignmentId = ", jobAssignmentId );


                            await updateJobAssignmentWithInfo(table, jobAssignmentId, azureAssetInfo);
                        } catch (error) {
                            console.error("Error updating the job",error);
                        }


                    }

                }

                break;

            case JOB_PROFILE_TRANSLATE_TEXT:
                throw new Error("Not Implemented");

            // 7. saving the transcriptionJobName on the jobAssignment
            // let jobAssignment = await getJobAssignment(table, jobAssignmentId);
            // jobAssignment.transcriptionJobName = data.TranscriptionJobName;
            // await putJobAssignment(resourceManager, table, jobAssignmentId, jobAssignment);

        }

        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const processNotification = async (event) => {
    
    
    console.log("ProcessNotification from Azure");


    console.log("ProcessNotification", JSON.stringify(event, null, 2));
    let jobAssignmentId = event.jobAssignmentId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);


    let flagCounter = 0;
    let azureVideoId;
    let azureState;
    if (notification) {

        if (notification.id) {
            flagCounter++;
            azureVideoId = notification.id;
        }

        if (notification.state) {
            flagCounter++;
            azureState = notification.state
        }
    }

    console.log("azureVideoId = ", azureVideoId);
    console.log("azureState = ", azureState);

    jobAssignment.status = azureState;
    


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


                    //Need to hydrate the destination bucket from the job input

                    let workflowJob = await retrieveWorkflowJob(table, jobAssignmentId);

                    //Retrieve JobProfile
                    let jobProfile = await retrieveJobProfile(workflowJob);
            
                    //Retrieve job inputParameters
                    let jobInput = await retrieveJobInput(workflowJob);

                    let jobOutputLocation = jobInput.outputLocation.awsS3Bucket;

                    // get the info about the destination bucket to store the result of the 
                    let s3Params = {
                        Bucket: jobOutputLocation,
                        Key: azureVideoId + "-" + uuidv4() + ".json",
                        Body: JSON.stringify(videoMetadata,null,2)
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
                  //  await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");

                }
            }
        

    }


///***** */

    //jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl);

    await resourceManager.sendNotification(jobAssignment);
}





const validateJobProfile = (jobProfile, jobInput) => {
    if (jobProfile.name !== JOB_PROFILE_TRANSCRIBE_AUDIO &&
        jobProfile.name !== JOB_PROFILE_TRANSLATE_TEXT && jobProfile.name !== JOB_PROFILE_EXTRACT_ALL_AI_METADATA) {
        throw new Error("JobProfile '" + jobProfile.name + "' is not supported");
    }

    if (jobProfile.inputParameters) {
        if (!Array.isArray(jobProfile.inputParameters)) {
            throw new Error("JobProfile.inputParameters is not an array");
        }

        for (parameter of jobProfile.inputParameters) {
            if (jobInput[parameter.parameterName] === undefined) {
                throw new Error("jobInput misses required input parameter '" + parameter.parameterName + "'");
            }
        }
    }
}

const retrieveJobInput = async (job) => {
    return await retrieveResource(job.jobInput, "job.jobInput");
}

const retrieveJobProfile = async (job) => {
    return await retrieveResource(job.jobProfile, "job.jobProfile");
}

const retrieveWorkflowJob = async (table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resource, resourceName) => {
    let type = typeof resource;

    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    if (type === "string") {  // if type is a string we assume it's a URL.
        try {
            let response = await MCMA_CORE.HTTP.get(resource);
            resource = response.data;
        } catch (error) {
            throw new Error("Failed to retrieve '" + resourceName + "' from url '" + resource + "'");
        }
    }

    type = typeof resource;

    if (type === "object") {
        if (Array.isArray(resource)) {
            throw new Error(resourceName + " has illegal type 'Array'");
        }

        return resource;
    } else {
        throw new Error(resourceName + " has illegal type '" + type + "'");
    }
}

const updateJobAssignmentWithOutput = async (table, jobAssignmentId, jobOutput) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.jobOutput = jobOutput;
    await putJobAssignment(null, table, jobAssignmentId, jobAssignment);
}



const updateJobAssignmentWithInfo = async (table, jobAssignmentId, jobInfo) => {

    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.jobInfo = jobInfo;
    await putJobAssignment(null, table, jobAssignmentId, jobAssignment);
}


const updateJobAssignmentStatus = async (resourceManager, table, jobAssignmentId, status, statusMessage) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.status = status;
    jobAssignment.statusMessage = statusMessage;
    await putJobAssignment(resourceManager, table, jobAssignmentId, jobAssignment);
}

const getJobAssignment = async (table, jobAssignmentId) => {
    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        throw new Error("JobAssignment with id '" + jobAssignmentId + "' not found");
    }
    return jobAssignment;
}

const putJobAssignment = async (resourceManager, table, jobAssignmentId, jobAssignment) => {
    jobAssignment.dateModified = new Date().toISOString();
    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    if (resourceManager) {
        await resourceManager.sendNotification(jobAssignment);
    }
}
