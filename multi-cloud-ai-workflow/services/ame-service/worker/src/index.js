//"use strict";

const childProcess = require("child_process");
const fs = require("fs")
const path = require("path");
const util = require('util');
const uuidv4 = require('uuid/v4');

const execFile = util.promisify(childProcess.execFile);
const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

// adding bin folder to process path
process.env["PATH"] = process.env["PATH"] + ":" + process.env["LAMBDA_TASK_ROOT"] + "/bin";

const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const S3GetObject = util.promisify(S3.getObject.bind(S3));
const S3PutObject = util.promisify(S3.putObject.bind(S3));

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

const JOB_PROFILE_EXTRACT_TECHNICAL_METADATA = "ExtractTechnicalMetadata";

const authenticatorAWS4 = new MCMA_CORE.AwsV4Authenticator({
    accessKey: AWS.config.credentials.accessKeyId,
    secretKey: AWS.config.credentials.secretAccessKey,
	sessionToken: AWS.config.credentials.sessionToken,
	region: AWS.config.region
});

const authProvider = new MCMA_CORE.AuthenticatorProvider(
    async (authType, authContext) => {
        switch (authType) {
            case "AWS4":
                return authenticatorAWS4;
        }
    }
);

const createResourceManager = (event) => {
    return new MCMA_CORE.ResourceManager({
        servicesUrl: event.request.stageVariables.ServicesUrl,
        servicesAuthType: event.request.stageVariables.ServicesAuthType,
        servicesAuthContext: event.request.stageVariables.ServicesAuthContext,
        authProvider
    });
}

const mediaInfo = async (params) => {
    try {
        const { stdout, stderr } = await execFile(path.join(__dirname, 'bin/mediainfo'), params);
        return {
            stdout: stdout,
            stderr: stderr
        }
    } catch (error) {
        console.log("ERROR MEDIAINFO", error);
    }
}

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    let resourceManager = createResourceManager(event);

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(resourceManager, table, jobAssignmentId, "RUNNING");

        // 2. Retrieving AmeJob
        let ameJob = await retrieveAmeJob(resourceManager, table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(resourceManager, ameJob);

        // 4. Retrieve job inputParameters
        let jobInput = await retrieveJobInput(resourceManager, ameJob);

        // 5. Check if we support jobProfile and if we have required parameters in jobInput
        validateJobProfile(jobProfile, jobInput);

        // 6. Execute media info on input file
        let inputFile = jobInput.inputFile;
        let outputLocation = jobInput.outputLocation;

        let output;

        if (inputFile.httpEndpoint) { // in case we receive a Locator with an httpEndpoint we'll use the mediaInfo option that can analyze while downloading the file directly
            // obtain mediainfo output
            output = await mediaInfo(["--Output=EBUCore_JSON", inputFile.httpEndpoint]);

        } else if (inputFile.awsS3Bucket && inputFile.awsS3Key) { // else we have to copy the file to internal storage (max 500mb) and analyze it directly
            // obtain data from s3 object
            let data = await S3GetObject({ Bucket: inputFile.awsS3Bucket, Key: inputFile.awsS3Key });

            // write data to local tmp storage
            let localFilename = "/tmp/" + uuidv4();
            await fsWriteFile(localFilename, data.Body);

            // obtain mediainfo output
            output = await mediaInfo(["--Output=EBUCore_JSON", localFilename]);

            // removing local file
            await fsUnlink(localFilename);
        } else {
            throw new Error("Not able to obtain input file");
        }

        // 7. check if we have mediaInfo output
        if (!output || !output.stdout) {
            throw new Error("Failed to obtain mediaInfo output")
        }

        // 8. Writing mediaInfo output to output location
        let s3Params = {
            Bucket: outputLocation.awsS3Bucket,
            Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
            Body: output.stdout
        }

        await S3PutObject(s3Params);

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
    if (jobProfile.name !== JOB_PROFILE_EXTRACT_TECHNICAL_METADATA) {
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

const retrieveJobInput = async (resourceManager, ameJob) => {
    return await retrieveResource(resourceManager, ameJob.jobInput, "ameJob.jobInput");
}

const retrieveJobProfile = async (resourceManager, ameJob) => {
    return await retrieveResource(resourceManager, ameJob.jobProfile, "ameJob.jobProfile");
}

const retrieveAmeJob = async (resourceManager, table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(resourceManager, jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resourceManager, resource, resourceName) => {
    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    resource = await resourceManager.resolve(resource);

    let type = typeof resource;

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
