// require
const AWS = require("aws-sdk");
const async = require("async");
const core = require("mcma-core");

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
            var taskToken = null;
            return stepfunctions.getActivityTask({ activityArn: JOB_PROCESS_ACTIVITY_ARN }, function (err, data) {
                if (err) {
                    return callback(err, err.stack);
                } else if (data) {
                    taskToken = data.taskToken;
                    console.log('Task Token =' + taskToken);
                    return callback(null, encodeURIComponent(taskToken));
                }
            });
        },
        (taskToken, callback) => { // Get JobProfiles by label
            return core.getJobProfilesByLabel(
                "mcma:TransformJob",
                jobProfileLabel,
                (err, jobProfiles) => callback(err, taskToken, jobProfiles));
        },
        (callback) => { // Create the new TransformJob, and Post TransformJob
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

            return core.postResource("mcma:TransferJob", transformJob, callback);
        },
        (callback) => { // Create the job process of ame job, and Post JobProcess
            event.workflow_param.transformjob_createproxy_id = transformJob.id;

            var jobProcess = new core.JobProcess(transformJob.id);

            console.log("posting JobProcess");
            console.log(JSON.stringify(jobProcess, null, 2));

            return core.postResource("fims:JobProcess", jobProcess, callback);
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
