import { URL } from "url";
import * as querystring from "querystring";
import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";
import { ProcessJobAssignmentHelper, ProviderCollection, WorkerRequest } from "@mcma/worker";
import { HttpClient } from "@mcma/client";
import { AwsS3FileLocator, AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties, getS3Url } from "@mcma/aws-s3";
import { AIJob, getTableName, JobAssignment } from "@mcma/core";

const S3 = new AWS.S3();
const httpClient = new HttpClient();

function getAzureConfig(jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const apiUrl = jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("AzureApiUrl"); // "https://api.videoindexer.ai"   
    const location = jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("AzureLocation");
    const accountId = jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("AzureAccountId");
    const subscriptionKey = jobAssignmentHelper.workerRequest.getRequiredContextVariable<string>("AzureSubscriptionKey");

    return { apiUrl, location, accountId, subscriptionKey };
}

export async function extractAllAiMetadata(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<AIJob>) {
    const logger = jobAssignmentHelper.logger;
    const jobInput = jobAssignmentHelper.jobInput;
    const jobOutput = jobAssignmentHelper.jobOutput;

    const jobAssignmentId = jobAssignmentHelper.jobAssignmentId;
    const azure = getAzureConfig(jobAssignmentHelper);

    let inputFile = jobInput.get<AwsS3FileLocatorProperties>("inputFile");
    let mediaFileUri = await getS3Url(inputFile, S3);

    // Get a token for API call - token are onlu good for one hour
    let authTokenUrl = azure.apiUrl + "/auth/" + azure.location + "/Accounts/" + azure.accountId + "/AccessToken?allowEdit=true";
    let customHeaders = { "Ocp-Apim-Subscription-Key": azure.subscriptionKey };

    logger.debug("Generate Azure Video Indexer Token: Doing a GET on  : ", authTokenUrl);
    let response = await httpClient.get(authTokenUrl, {
        headers: customHeaders
    });
    console.log("Generate Azure Video Indexer Token: GET Response", response);
    logger.debug("Generate Azure Video Indexer Token: GET Response", response);

    let apiToken = response.data;
    logger.debug("Azure API Token : ", apiToken);

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


    // Generate the call back URL leveraging the non secure api gateway endpoint

    const secureHost = new URL(jobAssignmentId).host;
    const nonSecureHost = new URL(jobAssignmentHelper.workerRequest.getRequiredContextVariable("PublicUrlNonSecure")).host;

    var callbackUrl = jobAssignmentId.replace(secureHost, nonSecureHost);
    callbackUrl = callbackUrl + "/notifications";
    callbackUrl = querystring.escape(callbackUrl);

    logger.debug("Callback url for Video Indexer: " + callbackUrl);

    let postVideoUrl = azure.apiUrl + "/" + azure.location + "/Accounts/" + azure.accountId + "/Videos?accessToken=" + apiToken + "&name=" + inputFile.awsS3Key + "&callbackUrl=" + callbackUrl + "&videoUrl=" + mediaFileUri + "&fileName=" + inputFile.awsS3Key;

    logger.debug("Call Azure Video Indexer Video API : Doing a POST on  : ", postVideoUrl);

    let postVideoResponse = await httpClient.post("", postVideoUrl);

    logger.debug("Azure API RAW Response postVideoResponse", postVideoResponse);

    if (postVideoResponse.status !== 200) {
        logger.error("Azure Video Indexer - Error processing the video : ", response);
    } else {
        let azureAssetInfo = postVideoResponse.data;
        logger.debug("azureAssetInfo: ", JSON.stringify(azureAssetInfo, null, 2));

        try {
            logger.debug("updateJobAssignmentWithInfo");
            logger.debug("jobAssignmentId = ", jobAssignmentId);

            jobOutput.set("jobInfo", azureAssetInfo);

            await jobAssignmentHelper.updateJobAssignmentOutput();
        } catch (error) {
            logger.error("Error updating the job", error);
        }
    }
}

export async function processNotification(providers: ProviderCollection, workerRequest: WorkerRequest) {
    const jobAssignmentHelper = new ProcessJobAssignmentHelper(
        await providers.dbTableProvider.get(getTableName(workerRequest)),
        providers.resourceManagerProvider.get(workerRequest),
        workerRequest
    );

    const logger = jobAssignmentHelper.logger;

    logger.debug("ProcessNotification", JSON.stringify(workerRequest, null, 2));
    const notification = workerRequest.input.notification;
    const azure = getAzureConfig(jobAssignmentHelper);

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
            azureState = notification.state;
        }
    }

    logger.debug("azureVideoId = ", azureVideoId);
    logger.debug("azureState = ", azureState);

    if (flagCounter !== 2) {
        logger.error("looks like the POST is not coming from Azure Video Indexer: expecting two parameters id and state");
        return;
    }

    try {
        await jobAssignmentHelper.initialize();

        // Get the AI metadata form Azure for the video
        logger.debug("The POST is coming from Azure. Next steps, get the metadata for the video  ");

        const authTokenUrl = azure.apiUrl + "/auth/" + azure.location + "/Accounts/" + azure.accountId + "/AccessToken?allowEdit=true";
        const customHeaders = { "Ocp-Apim-Subscription-Key": azure.subscriptionKey };

        logger.debug("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);

        const response = await httpClient.get(authTokenUrl, {
            headers: customHeaders
        });

        logger.debug("Azure API Token response : ", response);

        const apiToken = response.data;
        logger.debug("Azure API Token : ", apiToken);


        // https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos/{videoId}/Index[?accessToken][&language]   

        const metadataFromAzureVideoIndexwer = azure.apiUrl + "/" + azure.location + "/Accounts/" + azure.accountId + "/Videos/" + azureVideoId + "/Index?accessToken=" + apiToken + "&language=English";

        logger.debug("Get the azure video metadata : Doing a GET on  : ", metadataFromAzureVideoIndexwer);
        const indexedVideoMetadataResponse = await httpClient.get(metadataFromAzureVideoIndexwer);

        const videoMetadata = indexedVideoMetadataResponse.data;
        logger.debug("Azure AI video metadata : ", JSON.stringify(videoMetadata, null, 2));

        const outputLocation = jobAssignmentHelper.jobInput.get<AwsS3FolderLocatorProperties>("outputLocation");
        const jobOutputBucket = outputLocation.awsS3Bucket;
        const jobOutputKeyPrefix = outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "";

        // get the info about the destination bucket to store the result of the job
        const s3Params = {
            Bucket: jobOutputBucket,
            Key: jobOutputKeyPrefix + azureVideoId + "-" + uuidv4() + ".json",
            Body: JSON.stringify(videoMetadata, null, 2)
        };

        await S3.putObject(s3Params).promise();

        //updating JobAssignment with jobOutput
        jobAssignmentHelper.jobOutput.set("outputFile", new AwsS3FileLocator({
            awsS3Bucket: s3Params.Bucket,
            awsS3Key: s3Params.Key
        }));

        await jobAssignmentHelper.complete();

    } catch (error) {
        logger.error(error);
        try {
            await jobAssignmentHelper.fail(error.message);
        } catch (error) {
            logger.error(error);
        }
    }
}
