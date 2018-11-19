//"use strict";

const childProcess = require("child_process");
const fs = require("fs")
const path = require("path");
const util = require('util');
const uuidv4 = require('uuid/v4');

const execFile = util.promisify(childProcess.execFile);
const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);

// adding bin folder to process path
process.env["PATH"] = process.env["PATH"] + ":" + process.env["LAMBDA_TASK_ROOT"] + "/bin";

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const JOB_PROFILE_CREATE_PROXY_LAMBDA = "CreateProxyLambda";
const JOB_PROFILE_CREATE_PROXY_EC2 = "CreateProxyEC2";

const authenticator = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
    region: AWS.config.region
});
const authenticatedHttp = new MCMA_CORE.AuthenticatedHttp(authenticator);

const ffmpeg = async (params) => {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, 'bin/ffmpeg'), params);

        return {
            stdout: stdout,
            stderr: stderr
        }
    } catch (error) {
        console.log("ERROR FFMPEG", error);
    }
}

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 */
exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

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

    // init
    let variables = event.request.stageVariables;
    let resourceManager = new MCMA_CORE.ResourceManager(variables.ServicesUrl, authenticator);
    let table = new MCMA_AWS.DynamoDbTable(AWS, variables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {

        // 1. Setting job assignment status to RUNNING
        // console.log("1. Setting job assignment status to RUNNING");
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving TransformJob
        // console.log("2. Retrieving TransformJob");
        let transformJob = await retrieveTranformJob(table, jobAssignmentId);

        // 3. Retrieve JobProfile
        // console.log("3. Retrieve JobProfile");
        let jobProfile = await retrieveJobProfile(transformJob);

        // 4. Retrieve job inputParameters
        // console.log("4. Retrieve job inputParameters");
        let jobInput = await retrieveJobInput(transformJob);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        // console.log("5. Check if we support jobProfile and if we have required parameters in jobInput");
        validateJobProfile(jobProfile, jobInput);

        switch (jobProfile.name) {
            case JOB_PROFILE_CREATE_PROXY_LAMBDA:
                // 6. Execute ffmepg on input file
                // console.log("6. Execute ffmepg on input file");
                let inputFile = jobInput.inputFile;
                let outputLocation = jobInput.outputLocation;

                let tempFilename;
                if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

                    // 6.1. obtain data from s3 object
                    console.log(" 6.1. obtain data from s3 object");
                    let data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

                    // 6.2. write data to local tmp storage
                    console.log("6.2. write data to local tmp storage");
                    let localFilename = "/tmp/" + uuidv4();
                    await fsWriteFile(localFilename, data.Body);

                    // 6.3. obtain ffmpeg output
                    console.log("6.3. obtain ffmpeg output");
                    tempFilename = "/tmp/" + uuidv4() + ".mp4";
                    let params = ["-y", "-i", localFilename, "-preset", "ultrafast", "-vf", "scale=-1:360", "-c:v", "libx264", "-pix_fmt", "yuv420p", tempFilename];
                    let output = await ffmpeg(params);

                    // 6.4. removing local file
                    console.log("6.4. removing local file");
                    await fsUnlink(localFilename);

                } else {
                    throw new Error("Not able to obtain input file");
                }

                // 7. Writing ffmepg output to output location
                // console.log("7. Writing ffmepg output to output location");

                let s3Params = {
                    Bucket: outputLocation.awsS3Bucket,
                    Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".mp4",
                    Body: await fsReadFile(tempFilename)
                }

                await S3PutObject(s3Params);

                // 8. removing temp file
                // console.log("8. removing temp file");
                await fsUnlink(tempFilename);

                // 9. updating JobAssignment with jobOutput
                let jobOutput = new MCMA_CORE.JobParameterBag({
                    outputFile: new MCMA_CORE.Locator({
                        awsS3Bucket: s3Params.Bucket,
                        awsS3Key: s3Params.Key
                    })
                });

                await updateJobAssignmentWithOutput(table, jobAssignmentId, jobOutput);

                // 10. Setting job assignment status to COMPLETED
                await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "COMPLETED");
                break;
            case JOB_PROFILE_CREATE_PROXY_EC2:
                let ec2hostname = variables.HostnameInstanceEC2;

                let ec2Url = "http://" + ec2hostname + "/new-transform-job"

                let message = {
                    input: jobInput,
                    notificationEndpoint: new MCMA_CORE.NotificationEndpoint(jobAssignmentId + "/notifications")
                }

                console.log("Sending to", ec2Url, "message", message);
                await authenticatedHttp.post(ec2Url, message);
                console.log("Done");
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

const processNotification = async (event) => {
    let jobAssignmentId = event.jobAssignmentId;
    let notification = event.notification;

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);

    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);

    jobAssignment.status = notification.content.status;
    jobAssignment.statusMessage = notification.content.statusMessage;
    if (notification.content.progress !== undefined) {
        jobAssignment.progress = notification.content.progress;
    }
    jobAssignment.jobOutput = notification.content.output;
    jobAssignment.dateModified = new Date().toISOString();

    await table.put("JobAssignment", jobAssignmentId, jobAssignment);

    let resourceManager = new MCMA_CORE.ResourceManager(event.request.stageVariables.ServicesUrl, authenticator);

    await resourceManager.sendNotification(jobAssignment);
}

/**
 * Validate Job Profile
 * @param {*} jobProfile JobProfile 
 * @param {*} jobInput JobInput
 */
const validateJobProfile = (jobProfile, jobInput) => {
    if (jobProfile.name !== JOB_PROFILE_CREATE_PROXY_LAMBDA &&
        jobProfile.name !== JOB_PROFILE_CREATE_PROXY_EC2) {
        throw new Error("JobProfile '" + jobProfile.name + "' is not supported");
    }

    if (jobProfile.inputParameters) {
        if (!Array.isArray(jobProfile.inputParameters)) {
            throw new Error("JobProfile.inputParameters is not an array");
        }

        for (let parameter of jobProfile.inputParameters) {
            if (jobInput[parameter.parameterName] === undefined) {
                throw new Error("jobInput misses required input parameter '" + parameter.parameterName + "'");
            }
        }
    }
}

const retrieveJobInput = async (transformJob) => {
    return await retrieveResource(transformJob.jobInput, "transformJob.jobInput");
}

const retrieveJobProfile = async (transformJob) => {
    return await retrieveResource(transformJob.jobProfile, "transformJob.jobProfile");
}

const retrieveTranformJob = async (table, jobAssignmentId) => {
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
            let response = await authenticatedHttp.get(resource);
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
