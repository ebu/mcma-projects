//"use strict";

const util = require("util");
const uuidv4 = require("uuid/v4");

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetBucketLocation = util.promisify(S3.getBucketLocation.bind(S3));
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));
const S3CopyObject = util.promisify(S3.copyObject.bind(S3));
const S3DeleteObject = util.promisify(S3.deleteObject.bind(S3));

const TranscribeService = new AWS.TranscribeService();
const TranscribeServiceStartTranscriptionJob = util.promisify(TranscribeService.startTranscriptionJob.bind(TranscribeService));

const Rekognition = new AWS.Rekognition();
const RekognitionStartCelebrityRecognition = util.promisify(Rekognition.startCelebrityRecognition.bind(Rekognition));

const RekognitionGetCelebrityRecognition = util.promisify(Rekognition.getCelebrityRecognition.bind(Rekognition));


const Translate = new AWS.Translate({ apiVersion: '2017-07-01' });
const TranslateText = util.promisify(Translate.translateText.bind(Translate));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const crypto = require("crypto");

const JOB_PROFILE_TRANSCRIBE_AUDIO = "AWSTranscribeAudio";
const JOB_PROFILE_TRANSLATE_TEXT = "AWSTranslateText";
const JOB_PROFILE_DETECT_CELEBRITIES = "AWSDetectCelebrities";

var REKO_SNS_ROLE_ARN = process.env["REKO_SNS_ROLE_ARN"];
var SNS_TOPIC_ARN = process.env["SNS_TOPIC_ARN"];

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    try {
        switch (event.action) {
            case "ProcessJobAssignment":
                await processJobAssignment(event);
                break;
            case "ProcessTranscribeJobResult":
                await processTranscribeJobResult(event);
                break;
            case "ProcessRekognitionResult":
                await processRekognitionResult(event);
                break;
            default:
                throw new Error("Unknown action");
        }
    } catch (error) {
        console.error("Processing action '" + event.action + "' ended with error: '" + error.message + "'");
    }
}

const processJobAssignment = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.stageVariables.ServicesUrl);
    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving AiJob
        let job = await retrieveJob(table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(job);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(job);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        validateJobProfile(jobProfile, jobInput);

        // 6. start the appropriate ai service
        let inputFile = jobInput.inputFile;
        let outputLocation = jobInput.outputLocation;

        let params, data;

        switch (jobProfile.name) {
            case JOB_PROFILE_TRANSCRIBE_AUDIO:
                // obtain media file URL
                let mediaFileUrl;

                if (inputFile.httpEndpoint) {
                    mediaFileUrl = inputFile.httpEndpoint;
                } else {
                    data = await S3GetBucketLocation({ Bucket: inputFile.awsS3Bucket });
                    console.log(JSON.stringify(data, null, 2));
                    const s3SubDomain = data.LocationConstraint && data.LocationConstraint.length > 0 ? `s3-${data.LocationConstraint}` : "s3";
                    mediaFileUrl = "https://" + s3SubDomain + ".amazonaws.com/" + inputFile.awsS3Bucket + "/" + inputFile.awsS3Key;
                }
                let mediaFormat;

                if (mediaFileUrl.toLowerCase().endsWith("mp3")) {
                    mediaFormat = "mp3";
                } else if (mediaFileUrl.toLowerCase().endsWith("mp4")) {
                    mediaFormat = "mp4";
                } else if (mediaFileUrl.toLowerCase().endsWith("wav")) {
                    mediaFormat = "wav";
                } else if (mediaFileUrl.toLowerCase().endsWith("flac")) {
                    mediaFormat = "flac";
                } else {
                    throw new Error("Unable to determine Media Format from input file '" + mediaFileUrl + "'");
                }

                params = {
                    TranscriptionJobName: "TranscriptionJob-" + jobAssignmentId.substring(jobAssignmentId.lastIndexOf("/") + 1),
                    LanguageCode: "en-US",
                    Media: {
                        MediaFileUri: mediaFileUrl
                    },
                    MediaFormat: mediaFormat,
                    OutputBucketName: event.stageVariables.ServiceOutputBucket
                }

                data = await TranscribeServiceStartTranscriptionJob(params);

                console.log(JSON.stringify(data, null, 2));
                break;
            case JOB_PROFILE_TRANSLATE_TEXT:
                // get input text file
                let s3Bucket = inputFile.awsS3Bucket;
                let s3Key = inputFile.awsS3Key;
                let s3Object;
                try {
                    s3Object = await S3GetObject({
                        Bucket: s3Bucket,
                        Key: s3Key,
                    });
                } catch (error) {
                    throw new Error("Unable to read file in bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
                }

                let inputText = s3Object.Body.toString();

                // start translation job
                params = {
                    SourceLanguageCode: jobInput.sourceLanguageCode || 'auto',
                    TargetLanguageCode: jobInput.targetLanguageCode,
                    Text: inputText
                };

                console.log("Invoking translation service with parameters", JSON.stringify(params, null, 2));

                data = await TranslateText(params)

                // write result to file
                let s3Params = {
                    Bucket: outputLocation.awsS3Bucket,
                    Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".txt",
                    Body: data.TranslatedText
                }

                await S3PutObject(s3Params);

                // updating JobAssignment with jobOutput
                let jobOutput = new MCMA_CORE.JobParameterBag({
                    outputFile: new MCMA_CORE.Locator({
                        awsS3Bucket: s3Params.Bucket,
                        awsS3Key: s3Params.Key
                    })
                });

                await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

                // Setting job assignment status to COMPLETED
                await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");
                break;
            case JOB_PROFILE_DETECT_CELEBRITIES:

                let clientToken = crypto.randomBytes(16).toString("hex");
                let base64JobId = new Buffer(jobAssignmentId).toString('hex');


                params = {
                    Video: { /* required */
                        S3Object: {
                            Bucket: inputFile.awsS3Bucket,
                            Name: inputFile.awsS3Key
                        }
                    },
                    ClientRequestToken: clientToken,
                    JobTag: base64JobId,
                    NotificationChannel: {
                        RoleArn: REKO_SNS_ROLE_ARN,
                        SNSTopicArn: SNS_TOPIC_ARN
                    }
                };

                data = await RekognitionStartCelebrityRecognition(params);

                console.log(JSON.stringify(data, null, 2));
                break;


        }
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const processTranscribeJobResult = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.stageVariables.ServicesUrl);
    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    // 1. Retrieving Job based on jobAssignmentId
    let job = await retrieveJob(table, jobAssignmentId);

    try {
        // 2. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(job);

        // 3. Copy transcribe output file to output location
        let copySource = encodeURI(event.outputFile.awsS3Bucket + "/" + event.outputFile.awsS3Key);

        let s3Bucket = jobInput.outputLocation.awsS3Bucket;
        let s3Key = (jobInput.outputLocation.awsS3KeyPrefix ? jobInput.outputLocation.awsS3KeyPrefix : "") + event.outputFile.awsS3Key;

        try {
            await S3CopyObject({
                CopySource: copySource,
                Bucket: s3Bucket,
                Key: s3Key,
            });
        } catch (error) {
            throw new Error("Unable to copy output file to bucket '" + s3Bucket + "' with key '" + s3Key + "' due to error: " + error.message);
        }

        // 4. updating JobAssignment with jobOutput
        let jobOutput = new MCMA_CORE.JobParameterBag({
            outputFile: new MCMA_CORE.Locator({
                awsS3Bucket: s3Bucket,
                awsS3Key: s3Key
            })
        });
        await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

        // 5. Setting job assignment status to COMPLETED
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }

    // Cleanup: Deleting original output file
    try {
        await S3DeleteObject({
            Bucket: event.outputFile.awsS3Bucket,
            Key: event.outputFile.awsS3Key,
        });
    } catch (error) {
        console.warn("Failed to cleanup transcribe output file");
    }
}



const processRekognitionResult = async (event) => {
    let resourceManager = new MCMA_CORE.ResourceManager(event.stageVariables.ServicesUrl);
    let table = new MCMA_AWS.DynamoDbTable(AWS, event.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    // 1. Retrieving Job based on jobAssignmentId
    let job = await retrieveJob(table, jobAssignmentId);

    try {
        // 2. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(job);

        let s3Bucket = jobInput.outputLocation.awsS3Bucket;
       
        let rekoJobId = event.jobExternalInfo.rekoJobId;
        let rekoJobType = event.jobExternalInfo.rekoJobType;
        let status = event.jobExternalInfo.status;
   

        if (status != 'SUCCEEDED') {
            throw new Error("AI Rekognition failed job info: rekognition status:" + status);
        }

        // 3. Get the result from the Rekognition service 

        let data;

        switch (rekoJobType) {
            case "StartLabelDetection":
                throw new Error("StartLabelDetection : Not implemented");
                break;

            case "StartContentModeration":
                throw new Error("StartLabelDetection : Not implemented");
                break;

            case "StartPersonTracking":
                throw new Error("StartLabelDetection : Not implemented");
                break;

            case "StartCelebrityRecognition":
                var params = {
                    JobId: rekoJobId, /* required */
                    MaxResults: 1000000,
                    SortBy: 'TIMESTAMP'
                };
                RekognitionGetCelebrityRecognition
                data = await RekognitionGetCelebrityRecognition(params);

                break;

            case "StartFaceDetection":
                throw new Error("StartLabelDetection : Not implemented");
                break;

            case "StartFaceSearch":
                throw new Error("StartLabelDetection : Not implemented");
                break;
            default:
                throw new Error("Unknown rekoJobType");
        }


        if (!data) {
            throw new Error("No data was returned by AWS Rekogntion");
        } else {

            console.log("data returned by Reckognition", JSON.stringify(data, null, 2));
            // AWS Reko may create empty json element
            // remove them
            walkclean(data);

            
            // 3. write Reko output file to output location
            newS3Key = "reko_" + uuidv4() + ".json";
            let s3Params = {
                Bucket: s3Bucket,
                Key: newS3Key ,
                Body: JSON.stringify(data)
            }


            try {
                await S3PutObject(s3Params);
            } catch (error) {
                throw new Error("Unable to write output file to bucket '" + s3Bucket + "' with key '" + newS3Key + "' due to error: " + error.message);
            }

        console.log("Wrote Reko result file to S3 bucket : " + s3Bucket + " S3 key : " + newS3Key);


        // 4. updating JobAssignment with jobOutput
        let jobOutput = new MCMA_CORE.JobParameterBag({
            outputFile: new MCMA_CORE.Locator({
                awsS3Bucket: s3Bucket,
                awsS3Key: newS3Key
            })
        });
        await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

        

        // 5. Setting job assignment status to COMPLETED
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");

    }
    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }

   }




const validateJobProfile = (jobProfile, jobInput) => {
    if (jobProfile.name !== JOB_PROFILE_TRANSCRIBE_AUDIO &&
        jobProfile.name !== JOB_PROFILE_TRANSLATE_TEXT &&
        jobProfile.name !== JOB_PROFILE_DETECT_CELEBRITIES) {
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

const retrieveJob = async (table, jobAssignmentId) => {
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


function walkclean(x) {
    var type = typeof x;
    if (x instanceof Array) {
        type = 'array';
    }
    if ((type == 'array') || (type == 'object')) {
        for (k in x) {
            var v = x[k];
            if ((v === '') && (type == 'object')) {
                delete x[k];
            } else {
                walkclean(v);
            }
        }
    }
}