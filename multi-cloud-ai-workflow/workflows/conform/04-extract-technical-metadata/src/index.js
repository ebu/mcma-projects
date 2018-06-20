// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

// Environment Variable(AWS Lambda)
const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;
const JOB_OUTPUT_BUCKET = process.env.JOB_OUTPUT_BUCKET;
const JOB_OUTPUT_KEY_PREFIX = process.env.JOB_OUTPUT_KEY_PREFIX;
const JOB_SUCCESS_URL = process.env.JOB_SUCCESS_URL;
const JOB_FAILED_URL = process.env.JOB_FAILED_URL;
const JOB_PROCESS_ACTIVITY_ARN = process.env.JOB_PROCESS_ACTIVITY_ARN;
const JOB_PROFILE_LABEL = "ExtractTechnicalMetadata";

// mcma-core settings
core.setServiceRegistryServicesURL(SERVICE_REGISTRY_URL + "/Service");

/**
 * Lambda function handler
 * @param {*} event event
 * @param {*} context context
 * @param {*} callback callback
 */
exports.handler = (event, context, callback) => {
    // Read options from the event.
    console.log("Event:");
    console.log(JSON.stringify(event, null, 2));
    // Execute async waterfall
    async.waterfall([
        (callback) => { // Get Activity Task from Step Functions
            return stepfunctions.getActivityTask({ activityArn: JOB_PROCESS_ACTIVITY_ARN }, function (err, data) {
                if (err) {
                    return callback(err, err.stack);
                } else if (data) {
                    var taskToken = data.taskToken;
                    console.log('Task Token =' + taskToken);
                    return callback(null, encodeURIComponent(taskToken));
                }
            });
        },
        (taskToken, callback) => { // Get JobProfiles by label
            return core.getJobProfilesByLabel("mcma:AmeJob", jobProfileLabel, (err, jobProfiles) => callback(err, taskToken, jobProfiles));
        },
        (taskToken, jobProfiles, callback) => { // Create the new ame job, and Post AmeJob
            var jobProfile = jobProfiles.length > 0 ? jobProfiles[0] : null;
            if (!jobProfile) {
                return callback("JobProfile '" + jobProfileLabel + "' not found");
            }
            // Init job profile
            var jobProfile = jobProfile.id ? jobProfile.id : jobProfile;
            // Create a bag of job parameter
            var parameter = new core.JobParameterBag({
                "mcma:inputFile": event.workflow_param.essenceLocator,
                "mcma:outputLocation": new core.Locator({
                    awsS3Bucket: JOB_OUTPUT_BUCKET,
                    awsS3Key: JOB_OUTPUT_KEY_PREFIX
                })
            });
            // Create async endpoint
            var asyncEndpoint = new core.AsyncEndpoint(
                JOB_SUCCESS_URL + taskToken,
                JOB_FAILED_URL + taskToken
            );
            // Create ame-job data
            var ameJob = new core.AmeJob(
                jobProfile,
                parameter,
                asyncEndpoint
            );
            // Posting AMEJob
            console.log("posting ame job:");
            console.log(JSON.stringify(ameJob, null, 2));
            return core.postResource("mcma:AmeJob", ameJob, callback);
        },
        (callback) => { // Create the job process of ame job, and Post JobProcess
            event.workflow_param.amejob_id = ameJob.id;
            // Posting JobProcess
            var jobProcess = new core.JobProcess(ameJob.id);
            console.log("posting job process:");
            console.log(JSON.stringify(jobProcess, null, 2));
            return core.postResource("mcma:JobProcess", jobProcess, callback);
        }
    ], (err) => {
        // Process results
        if (err) {
            console.error("Error:");
            console.error(err);
        }
        callback(err, event);
    });
}
