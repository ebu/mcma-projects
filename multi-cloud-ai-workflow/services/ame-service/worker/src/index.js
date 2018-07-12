
const AWS = require("aws-sdk");

const axios = require("axios");
const MCMA_AWS = require("mcma-aws");

const JOB_PROFILE_EXTRACT_TECHNICAL_METADATA = "ExtractTechnicalMetadata";

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    let table = new MCMA_AWS.DynamoDbTable(AWS, event.request.stageVariables.TableName);
    let jobAssignmentId = event.jobAssignmentId;

    try {
        // 1. Setting job assignment status to RUNNING
        await updateJobAssignmentStatus(table, jobAssignmentId, "RUNNING");

        // 2. Retrieving AmeJob
        let ameJob = await retrieveAmeJob(table, jobAssignmentId);

        // 3. Retrieve JobProfile
        let jobProfile = await retrieveJobProfile(ameJob);

        // 4. Retrieve job inputParameters
        let jobInputParameters = await retrieveJobInputParameters(ameJob);

        // 5. Check if we support jobProfile and if we have required parameters
        validateJobProfile(jobProfile, jobInputParameters);

        // 6. Execute media info on input file
        let inputFile = jobInputParameters.inputFile;
        let outputLocation = jobInputParameters.outputLocation;

        if (inputFile.httpEndpoint) {

        } else if (inputFile.awsS3Bucket && inputFile.awsS3Key) {

        } else {
            throw Error("File not found");
        }

        // x. Setting job assignment status to COMPLETED
        await updateJobAssignmentStatus(table, jobAssignmentId, "COMPLETED");

    } catch (error) {
        console.error(error);
        try {
            await updateJobAssignmentStatus(table, jobAssignmentId, "FAILED", error.message);
        } catch (error) {
            console.error(error);
        }
    }
}

const validateJobProfile = (ameJob, jobProfile) => {
    if (jobProfile.name !== JOB_PROFILE_EXTRACT_TECHNICAL_METADATA) {
        throw new Error("JobProfile '" + jobProfile.name + "' is not supported");
    }
}

const retrieveJobInputParameters = async (ameJob) => {
    return await retrieveResource(ameJob.inputParameters, "ameJob.inputParameters");
}

const retrieveJobProfile = async (ameJob) => {
    return await retrieveResource(ameJob.jobProfile, "ameJob.jobProfile");
}

const retrieveAmeJob = async (table, jobAssignmentId) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);

    return await retrieveResource(jobAssignment.job, "jobAssignment.job");
}

const retrieveResource = async (resource, resourceName) => {
    let type = typeof resource;

    if (!resource) {
        throw new Error(resourceName + " does not exist");
    }

    if (type === "string") {  // if type is a string we assume it's a URL.
        resource = await axios.get(resource).data;
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

const updateJobAssignmentStatus = async (table, jobAssignmentId, status, statusMessage) => {
    let jobAssignment = await getJobAssignment(table, jobAssignmentId);
    jobAssignment.status = status;
    jobAssignment.statusMessage = statusMessage;
    await putJobAssignment(table, jobAssignmentId, jobAssignment);
}

const getJobAssignment = async (table, jobAssignmentId) => {
    let jobAssignment = await table.get("JobAssignment", jobAssignmentId);
    if (!jobAssignment) {
        throw new Error("JobAssignment with id '" + jobAssignmentId + "' not found");
    }
    return jobAssignment;
}

const putJobAssignment = async (table, jobAssignmentId, jobAssignment) => {
    jobAssignment.dateModified = new Date().toISOString();
    await table.put("JobAssignment", jobAssignmentId, jobAssignment);
}
