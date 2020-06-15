import * as fs from "fs";

import { v4 as uuidv4 } from "uuid";
import * as path from "path";

import { config, S3 } from "aws-sdk";
import { JobAssignment, JobParameterBag, JobProcess, JobProfile, JobStatus, McmaException, McmaTracker, TransformJob, WorkflowJob } from "@mcma/core";
import { AuthProvider, ResourceManager } from "@mcma/client";
import { AwsS3FileLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

import { BMContent, BMEssence, DescriptiveMetadata } from "@local/common";

config.loadFromPath("../../deployment/aws-credentials.json");

const s3 = new S3();

const TEST_FILE = "../2015_GF_ORF_00_18_09_conv.mp4";

async function sleep(timeout) {
    return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}

async function uploadFileToBucket(bucket, prefix, filename) {
    const fileStream = fs.createReadStream(filename);
    fileStream.on("error", function (err) {
        console.log("File Error", err);
    });
    const uploadParams = { Bucket: bucket, Key: prefix + path.basename(filename), Body: fileStream };

    await s3.upload(uploadParams).promise();

    return new AwsS3FileLocator({
        awsS3Bucket: uploadParams.Bucket,
        awsS3Key: uploadParams.Key,
    });
}

async function createWorkflowJob(resourceManager: ResourceManager, inputFile: AwsS3FileLocator) {
    const [jobProfile] = await resourceManager.query(JobProfile, { name: "AiWorkflow" });

    if (!jobProfile) {
        throw new McmaException("JobProfile 'AiWorkflow' not found");
    }

    let bmContent = new BMContent({
        metadata: new DescriptiveMetadata({
            name: "Test title",
            description: "Test description",
        })
    });

    bmContent = await resourceManager.create(bmContent);

    let bmEssence = new BMEssence({
        bmContent: bmContent.id,
        locations: [
            inputFile,
        ]
    });

    bmEssence = await resourceManager.create(bmEssence);

    bmContent.essences = [bmEssence.id];
    bmContent = await resourceManager.update(bmContent);

    const workflowJob = new WorkflowJob({
        jobProfile: jobProfile.id,
        jobInput: new JobParameterBag({
            bmContent: bmContent.id,
            bmEssence: bmEssence.id,
        }),
        tracker: new McmaTracker({
            id: uuidv4(),
            label: "Test - AiWorkflow"
        })
    });

    return resourceManager.create(workflowJob);
}

async function main() {
    console.log("Starting Test AI Workflow");

    const terraformOutput = JSON.parse(fs.readFileSync("../../deployment/terraform.output.json", "utf8"));

    let servicesUrl = terraformOutput["service_registry_url"]?.value + "/services";
    let servicesAuthType = terraformOutput["service_registry_auth_type"]?.value;
    let servicesAuthContext = undefined;

    const resourceManagerConfig = {
        servicesUrl,
        servicesAuthType,
        servicesAuthContext
    };

    let resourceManager = new ResourceManager(resourceManagerConfig, new AuthProvider().add(awsV4Auth(config)));

    const keyPrefix = "test-extract-audio/" + new Date().toISOString() + "/";

    const bucketName = terraformOutput["website_bucket"]?.value;
    if (!bucketName) {
        throw new McmaException("Failed to get bucket from terraform output");
    }

    console.log("Uploading test video file to s3 bucket");
    const transformInputFile = await uploadFileToBucket(bucketName, keyPrefix, TEST_FILE);

    console.log("Create TransformJob with Extract Audio job profile");
    let job = await createWorkflowJob(resourceManager, transformInputFile);
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

    if (job.jobProcess) {
        const jobProcess = await resourceManager.get<JobProcess>(job.jobProcess);
        console.log(JSON.stringify(jobProcess, null, 2));

        if (jobProcess.jobAssignment) {
            const jobAssignment = await resourceManager.get<JobAssignment>(jobProcess.jobAssignment);
            console.log(JSON.stringify(jobAssignment, null, 2));
        }
    }
}

main().then(ignored => console.log("Done")).catch(error => console.error(error));
