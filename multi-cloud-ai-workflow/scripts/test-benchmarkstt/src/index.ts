import * as fs from "fs";

import { v4 as uuidv4 } from "uuid";
import * as path from "path";

import { config, EC2, ECS, S3 } from "aws-sdk";
import { JobAssignment, JobExecution, JobParameterBag, JobProfile, JobStatus, McmaException, McmaTracker, QAJob, TransformJob } from "@mcma/core";
import { AuthProvider, ResourceManager, ResourceManagerConfig } from "@mcma/client";
import { AwsS3FileLocator, AwsS3FolderLocator } from "@mcma/aws-s3";
import { awsV4Auth } from "@mcma/aws-client";

const AWS_CREDENTIALS = "../../deployment/aws-credentials.json";
const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

config.loadFromPath(AWS_CREDENTIALS);

const s3 = new S3();

const INPUT_FILE = "../benchmarkstt-hypothesis.txt";
const REFERENCE_FILE = "../benchmarkstt-reference.txt";

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

async function createBenchmarkSttJob(resourceManager: ResourceManager, inputFile: AwsS3FileLocator, referenceFile: AwsS3FileLocator, outputLocation: AwsS3FolderLocator) {
    const [jobProfile] = await resourceManager.query(JobProfile, { name: "BenchmarkSTT" });
    if (!jobProfile) {
        throw new McmaException("JobProfile 'BenchmarkSTT' not found");
    }

    const transformJob = new QAJob({
        jobProfile: jobProfile.id,
        jobInput: new JobParameterBag({
            inputFile,
            referenceFile,
            outputLocation,
        }),
        tracker: new McmaTracker({
            "id": uuidv4(),
            "label": "TestBenchmarkSTT"
        })
    });

    return resourceManager.create(transformJob);
}

async function fargateTest() {
    const ecs = new ECS();
    const ec2 = new EC2();

    const data = await ecs.listClusters().promise();
    console.log(JSON.stringify(data, null, 2));

    const [clusterArn] = data.clusterArns;

    const data2 = await ecs.listTasks({
        cluster: clusterArn,
        serviceName: "pt-rovers-mcma-dev-benchmarkstt"
    }).promise();
    console.log(JSON.stringify(data2, null, 2));

    const data3 = await ecs.describeTasks({
        cluster: clusterArn,
        tasks: data2.taskArns,
    }).promise();
    console.log(JSON.stringify(data3, null, 2));

    const data4 = await ec2.describeNetworkInterfaces({
        NetworkInterfaceIds: [data3.tasks[0].attachments[0].details[1].value]
    }).promise();
    console.log(JSON.stringify(data4, null, 2));

    const data5 = await ecs.listServices({
        cluster: "pt-rovers-mcma-dev",
    }).promise();
    console.log(JSON.stringify(data5, null, 2));

    const data6 = await ecs.describeServices({
        cluster: "pt-rovers-mcma-dev",
        services: data5.serviceArns,
    }).promise();
    console.log(JSON.stringify(data6, null, 2));
}

async function main() {
    // await fargateTest();
    // return;

    console.log("Starting Test Benchmark STT");

    const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));

    let servicesUrl = terraformOutput.service_registry_url.value + "/services";
    let servicesAuthType = terraformOutput.service_registry_auth_type.value;
    let servicesAuthContext = undefined;

    const resourceManagerConfig: ResourceManagerConfig = {
        servicesUrl,
        servicesAuthType,
        servicesAuthContext
    };

    let resourceManager = new ResourceManager(resourceManagerConfig, new AuthProvider().add(awsV4Auth(config)));

    const keyPrefix = "test-benchmarkstt/" + new Date().toISOString() + "/";

    const tempBucket = terraformOutput["temp_bucket"]?.value;
    if (!tempBucket) {
        throw new McmaException("Failed to get temp bucket from terraform output");
    }

    console.log("Uploading test files to temp bucket");
    const benchmarksttHypothesisFile = await uploadFileToBucket(tempBucket, keyPrefix, INPUT_FILE);
    const benchmarksttReferenceFile = await uploadFileToBucket(tempBucket, keyPrefix, REFERENCE_FILE);

    const transformOutputLocation = new AwsS3FolderLocator({
        bucket: tempBucket,
        keyPrefix: keyPrefix,
    });

    console.log("Create QA job with BenchmarkSTT job profile");
    let job = await createBenchmarkSttJob(resourceManager, benchmarksttHypothesisFile, benchmarksttReferenceFile, transformOutputLocation);
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
