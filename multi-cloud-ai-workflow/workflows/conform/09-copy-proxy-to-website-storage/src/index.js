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
        (callback) => { // retrieving task token.
            console.log("retrieving task token.");
            var taskToken;
            callback(null, encodeURIComponent(taskToken));

            // return stepfunctions.getActivityTask({ activityArn: JOB_PROCESS_ACTIVITY_ARN }, function (err, data) {
            //     var taskToken;

            //     if (err) {
            //         console.log(err, err.stack);
            //         //return callback(err);
            //     } else if (data) {
            //         taskToken = data.taskToken;
            //     }

            //     console.log('taskToken = ' + taskToken)

            //     return callback(null, encodeURIComponent(taskToken));
            // });
        },
        (taskToken, callback) => { // retrieving job profile(s) by label.
            console.log("retrieving job profile(s) by label.");
            var jobProfiles = [];
            callback(null, taskToken, jobProfiles);

            // return core.getJobProfilesByLabel("fims:TransformJob", jobProfileLabel, (err, jobProfiles) => callback(err, taskToken, jobProfiles));
        },
        (taskToken, jobProfiles, callback) => { // posting transfer job.
            console.log("posting transfer job.");
            // Checking job profiles
            var jobProfile = jobProfiles.length > 0 ? jobProfiles[0] : null;
            // Create job input
            // Question
            //   Unknown data format
            var jobInput = null;
            // var jobInput = new core.JobParameterBag({
            //     "mcma:inputFile": event.workflow_param.essenceLocator,
            //     "mcma:outputLocation": new core.Locator({
            //         awsS3Bucket: JOB_OUTPUT_BUCKET,
            //         awsS3Key: JOB_OUTPUT_KEY_PREFIX
            //     })
            // });
            // Create async endpoint
            var asyncEndpoint = new core.AsyncEndpoint(
                JOB_SUCCESS_URL + taskToken,
                JOB_FAILED_URL + taskToken
            );
            // Create transfer job data
            var transferJob = new core.TransferJob(jobProfile, jobInput, asyncEndpoint);
            console.log("TransferJob:");
            console.log(JSON.stringify(transferJob, null, 2));
            callback(null, transferJob);

            // return core.postResource("mcma:TransferJob", transformJob, callback);
        },
        (transferJob, callback) => { // posting job process.
            // event.workflow_param.transformjob_createproxy_id = transformJob.id;

            // var jobProcess = new core.JobProcess(transformJob.id);

            // console.log("posting JobProcess");
            // console.log(JSON.stringify(jobProcess, null, 2));

            // return core.postResource("fims:JobProcess", jobProcess, callback);

            callback();
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