const util = require("util");
const URL = require("url").URL;
const querystring = require("querystring");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const { Logger, HttpClient, JobAssignment, Locator, AIJob } = require("mcma-core");
const { WorkerJobHelper } = require("mcma-worker");
const { getAwsV4ResourceManager, DynamoDbTableProvider } = require("mcma-aws");

const httpClient = new HttpClient();

function getAzureConfig(workerJobHelper) {
    const apiUrl = workerJobHelper.getRequest().getRequiredContextVariable("AzureApiUrl"); // "https://api.videoindexer.ai"   
    const location = workerJobHelper.getRequest().getRequiredContextVariable("AzureLocation");
    const accountId = workerJobHelper.getRequest().getRequiredContextVariable("AzureAccountId");
    const subscriptionKey = workerJobHelper.getRequest().getRequiredContextVariable("AzureSubscriptionKey");

    return { apiUrl, location, accountId, subscriptionKey };
}

async function extractAllAiMetadata(workerJobHelper) {
    const jobAssignmentId = workerJobHelper.getJobAssignmentId();
    const inputFile = workerJobHelper.getJobInput().inputFile;
    const azure = getAzureConfig(workerJobHelper);
    
    let mediaFileUri;

    if (inputFile.httpEndpoint) {
        mediaFileUri = inputFile.httpEndpoint;
    } else {
        const data = await S3GetBucketLocation({ Bucket: inputFile.awsS3Bucket });
        Logger.debug(JSON.stringify(data, null, 2));
        const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
        mediaFileUri = "https://" + s3SubDomain + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
    }

    // Get a token for API call - token are onlu good for one hour
    let authTokenUrl = azure.apiUrl + "/auth/" + azure.location + "/Accounts/" + azure.accountId + "/AccessToken?allowEdit=true";
    let customHeaders = { "Ocp-Apim-Subscription-Key": azure.subscriptionKey };

    Logger.debug("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);
    let response = await httpClient.get(authTokenUrl, {
        headers: customHeaders
    });

    let apiToken = response.data;
    Logger.debug("Azure API Token : ", apiToken);

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
    const nonSecureHost = new URL(workerJobHelper.getRequest().getRequiredContextVariable("PublicUrlNonSecure")).host;

    var callbackUrl = jobAssignmentId.replace(secureHost, nonSecureHost);
    callbackUrl = callbackUrl + "/notifications";
    callbackUrl = querystring.escape(callbackUrl);

    Logger.debug("Callback url for Video Indexer: " + callbackUrl);

    let postVideoUrl = azure.apiUrl + "/" + azure.location + "/Accounts/" + azure.accountId + "/Videos?accessToken=" + apiToken + "&name=" + inputFile.awsS3Key + "&callbackUrl=" + callbackUrl + "&videoUrl=" + mediaFileUri + "&fileName=" + inputFile.awsS3Key;

    Logger.debug("Call Azure Video Indexer Video API : Doing a POST on  : ", postVideoUrl);

    let postVideoResponse = await httpClient.post(postVideoUrl);

    Logger.debug("Azure API RAW Response postVideoResponse", postVideoResponse);

    if (postVideoResponse.status != 200) {
        Logger.error("Azure Video Indexer - Error processing the video : ", response);
    }
    else {
        let azureAssetInfo = postVideoResponse.data;
        Logger.debug("azureAssetInfo: ", JSON.stringify(azureAssetInfo, null, 2));

        try {
            Logger.debug("updateJobAssignmentWithInfo");
            Logger.debug("jobAssignmentId = ", jobAssignmentId);


            workerJobHelper.getJobOutput().jobInfo = azureAssetInfo;

            await workerJobHelper.updateJobAssignmentOutput();
        } catch (error) {
            console.error("Error updating the job", error);
        }
    }
}

extractAllAiMetadata.profileName = "AzureExtractAllAIMetadata";

const dynamoDbTableProvider = new DynamoDbTableProvider(JobAssignment);

const processNotification = async (request) => {
    const workerJobHelper = new WorkerJobHelper(
        AIJob,
        dynamoDbTableProvider.table(request.tableName()),
        getAwsV4ResourceManager(request),
        request,
        request.input.jobAssignmentId
    );

    Logger.debug("ProcessNotification", JSON.stringify(request, null, 2));
    const notification = request.input.notification;
    const azure = getAzureConfig(workerJobHelper);

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

    Logger.debug("azureVideoId = ", azureVideoId);
    Logger.debug("azureState = ", azureState);

    if (flagCounter != 2) {
        Logger.error("looks like the POST is not coming from Azure Video Indexer: expecting two parameters id and state");
        return;
    }

    try {
        await workerJobHelper.initialize();

        // Get the AI metadata form Azure for the video
        Logger.debug("The POST is coming from Azure. Next steps, get the metadata for the video  ");

        const authTokenUrl = azure.apiUrl + "/auth/" + azure.location + "/Accounts/" + azure.accountId + "/AccessToken?allowEdit=true";
        const customHeaders = { "Ocp-Apim-Subscription-Key": azure.subscriptionKey };

        Logger.debug("Generate Azure Video Indexer Token : Doing a GET on  : ", authTokenUrl);

        const response = await httpClient.get(authTokenUrl, {
            headers: customHeaders
        });

        Logger.debug("Azure API Token response : ", response);

        const apiToken = response.data;
        Logger.debug("Azure API Token : ", apiToken);


        // https://api.videoindexer.ai/{location}/Accounts/{accountId}/Videos/{videoId}/Index[?accessToken][&language]   

        const metadataFromAzureVideoIndexwer = azure.apiUrl + "/" + azure.location + "/Accounts/" + azure.accountId + "/Videos/" + azureVideoId + "/Index?accessToken=" + apiToken + "&language=English";

        Logger.debug("Get the azure video metadata : Doing a GET on  : ", metadataFromAzureVideoIndexwer);
        const indexedVideoMetadataResponse = await httpClient.get(metadataFromAzureVideoIndexwer);

        const videoMetadata = indexedVideoMetadataResponse.data;
        Logger.debug("Azure AI video metadata : ", JSON.stringify(videoMetadata, null, 2));

        const outputLocation = workerJobHelper.getJobInput().outputLocation;
        const jobOutputBucket = outputLocation.awsS3Bucket;
        const jobOutputKeyPrefix = outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "";

        // get the info about the destination bucket to store the result of the job
        const s3Params = {
            Bucket: jobOutputBucket,
            Key: jobOutputKeyPrefix + azureVideoId + "-" + uuidv4() + ".json",
            Body: JSON.stringify(videoMetadata, null, 2)
        }

        await S3PutObject(s3Params);

        //updating JobAssignment with jobOutput
        workerJobHelper.getJobOutput().outputFile = new Locator({
            awsS3Bucket: s3Params.Bucket,
            awsS3Key: s3Params.Key
        });

        await workerJobHelper.complete();

    } catch (error) {
        Logger.exception(error);
        try {
            await workerJobHelper.fail(error.message);
        } catch (error) {
            Logger.exception(error);
        }
    }
}

module.exports = {
    extractAllAiMetadata,
    processNotification
};