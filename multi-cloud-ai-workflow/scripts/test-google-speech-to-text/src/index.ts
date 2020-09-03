import * as fs from "fs";

import { v4 as uuidv4 } from "uuid";
import * as path from "path";

import { config, S3 } from "aws-sdk";
import { AIJob, JobAssignment, JobExecution, JobParameterBag, JobProfile, JobStatus, McmaException, McmaTracker, TransformJob } from "@mcma/core";
import { AuthProvider, ResourceManager, ResourceManagerConfig } from "@mcma/client";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

config.loadFromPath("../../deployment/aws-credentials.json");

const s3 = new S3();

const TEST_FILE = "../2015_GF_ORF_00_18_09_conv.flac";

async function sleep(timeout: number) {
    return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}

async function uploadFileToBucket(bucket: string, prefix: string, filename: string) {
    const fileStream = fs.createReadStream(filename);
    fileStream.on("error", function (err) {
        console.log("File Error", err);
    });
    const uploadParams = { Bucket: bucket, Key: prefix + path.basename(filename), Body: fileStream };

    await s3.upload(uploadParams).promise();

    return new AwsS3FileLocator({
        bucket: uploadParams.Bucket,
        key: uploadParams.Key,
    });
}

async function createAiJob(resourceManager: ResourceManager, inputFile: AwsS3FileLocator, outputLocation: AwsS3FolderLocator) {
    const jobProfiles = await resourceManager.query(JobProfile, { name: "GoogleSpeechToText" });

    const jobProfileId = jobProfiles.shift()?.id;
    if (!jobProfileId) {
        throw new McmaException("JobProfile 'GoogleSpeechToText' not found");
    }

    const transformJob = new AIJob({
        jobProfile: jobProfileId,
        jobInput: new JobParameterBag({
            inputFile,
            outputLocation,
        }),
        tracker: new McmaTracker({
            id: uuidv4(),
            label: "Test"
        })
    });

    return resourceManager.create(transformJob);
}

async function main() {
    console.log("Starting Test Google Speech To Text");

    const terraformOutput = JSON.parse(fs.readFileSync("../../deployment/terraform.output.json", "utf8"));

    let servicesUrl = terraformOutput["service_registry_url"]?.value + "/services";
    let servicesAuthType = terraformOutput["service_registry_auth_type"]?.value;
    let servicesAuthContext = undefined;

    const resourceManagerConfig: ResourceManagerConfig = {
        servicesUrl,
        servicesAuthType,
        servicesAuthContext
    };

    let resourceManager = new ResourceManager(resourceManagerConfig, new AuthProvider().add(awsV4Auth(config)));

    const keyPrefix = "test-google-speech-to-text/" + new Date().toISOString() + "/";

    const tempBucket = terraformOutput["temp_bucket"]?.value;
    if (!tempBucket) {
        throw new McmaException("Failed to get temp bucket from terraform output");
    }

    console.log("Uploading test file to temp bucket: " + TEST_FILE);
    const transformInputFile = await uploadFileToBucket(tempBucket, keyPrefix, TEST_FILE);

    const transformOutputLocation = new AwsS3FolderLocator({
        bucket: tempBucket,
        keyPrefix: keyPrefix,
    });

    console.log("Create AiJob with GoogleSpeechToText job profile");
    let job = await createAiJob(resourceManager, transformInputFile, transformOutputLocation);
    const jobId = job.id;
    console.log("job.status = " + job.status);

    do {
        await sleep(1000);
        job = await resourceManager.get<TransformJob>(jobId);
        console.log("job.status = " + job.status);
    } while (job.status !== JobStatus.Completed &&
             job.status !== JobStatus.Failed &&
             job.status !== JobStatus.Canceled);

    console.log(JSON.stringify(job, null, 2));

    const jobExecution = await resourceManager.get<JobExecution>(`${job.id}/executions/1`);
    console.log(JSON.stringify(jobExecution, null, 2));

    if (jobExecution.jobAssignment) {
        const jobAssignment = await resourceManager.get<JobAssignment>(jobExecution.jobAssignment);
        console.log(JSON.stringify(jobAssignment, null, 2));
    }
}

main().then(ignored => console.log("Done")).catch(error => console.error(error));
