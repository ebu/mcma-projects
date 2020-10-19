import { ECS, S3 } from "aws-sdk";
// @ts-ignore
import { Client as RpcClient } from "node-json-rpc2";
import { v4 as uuidv4 } from "uuid";

import { EnvironmentVariables, Logger, McmaException, QAJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator } from "@mcma/aws-s3";

const environmentVariables = EnvironmentVariables.getInstance();

export async function benchmarkstt(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<QAJob>) {
    const logger = jobAssignmentHelper.logger;

    const jobInput = jobAssignmentHelper.jobInput;
    const inputFile = <AwsS3FileLocator>jobInput.inputFile;
    const referenceFile = <AwsS3FileLocator>jobInput.referenceFile;
    const outputLocation = jobInput.outputLocation;

    if (!inputFile.bucket || !inputFile.key) {
        throw new McmaException("Failed to find bucket and/or key properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }
    if (!referenceFile.bucket || !referenceFile.key) {
        throw new McmaException("Failed to find bucket and/or key properties on referenceFile:\n" + JSON.stringify(referenceFile, null, 2));
    }

    const s3 = new S3();
    const inputFileObject = await s3.getObject({
        Bucket: inputFile.bucket,
        Key: inputFile.key,
    }).promise();
    const inputText = inputFileObject.Body.toString();

    const referenceFileObject = await s3.getObject({
        Bucket: referenceFile.bucket,
        Key: referenceFile.key,
    }).promise();
    const referenceText = referenceFileObject.Body.toString();

    logger.info("Obtaining service ip address");
    const ipAddress = await getServiceIpAddress(logger);
    logger.info("IP Address: " + ipAddress);

    logger.info("Sending request to benchmarkstt service");
    const result = await invokeBenchmarksttService(ipAddress, inputText, referenceText, logger);
    logger.info(result);

    const putObjectParams = {
        Bucket: outputLocation.bucket,
        Key: (outputLocation.keyPrefix ? outputLocation.keyPrefix : "") + uuidv4() + ".json",
        Body: result
    };
    await s3.putObject(putObjectParams).promise();

    logger.info("Updating jobAssignment with job output");
    jobAssignmentHelper.jobOutput.outputFile = new AwsS3FileLocator({
        bucket: putObjectParams.Bucket,
        key: putObjectParams.Key
    });
    logger.info(jobAssignmentHelper.jobOutput.outputFile);

    await jobAssignmentHelper.complete();
}

async function invokeBenchmarksttService(ipAddress: string, inputText: string, referenceText: string, logger: Logger): Promise<string> {

    let client = new RpcClient({
        host: ipAddress,
        path: "/api",
        port: "8080",
    });

    const request = {
        method: "metrics.worddiffs",
        params: {
            hyp: inputText,
            ref: referenceText,
            dialect: "html"
        }
    };

    logger.info(request);

    return new Promise<string>((resolve, reject) => {
        client.call(request, (error: any, response: { result: string }) => {
            if (error) {
                return reject(error);
            }
            resolve(response.result);
        });
    });
}

async function getServiceIpAddress(logger: Logger): Promise<string> {
    const clusterName = environmentVariables.get("EcsClusterName");
    const benchmarksttServiceName = environmentVariables.get("EcsBenchmarksttServiceName");

    const ecs = new ECS();

    logger.info("Listing tasks for cluster '" + clusterName + "' and service '" + benchmarksttServiceName + "'");
    const listTaskData = await ecs.listTasks({
        cluster: clusterName,
        serviceName: benchmarksttServiceName
    }).promise();
    logger.info(listTaskData);

    if (listTaskData.taskArns.length === 0) {
        throw new McmaException("Failed to find a running task for service '" + benchmarksttServiceName + "'");
    }

    logger.info("Describing tasks");
    const describeTaskData = await ecs.describeTasks({
        cluster: clusterName,
        tasks: listTaskData.taskArns,
    }).promise();
    logger.info(describeTaskData);

    logger.info("Finding IP address of suitable task");
    let selectedTask = undefined;
    let privateIPv4Address = undefined;
    let networkInterfaceId = undefined;

    for (const task of describeTaskData.tasks) {
        if (task.lastStatus !== "RUNNING") {
            continue;
        }
        for (const attachment of task.attachments) {
            if (attachment.type !== "ElasticNetworkInterface" || attachment.status !== "ATTACHED") {
                continue;
            }

            privateIPv4Address = undefined;
            networkInterfaceId = undefined;
            for (const detail of attachment.details) {
                if (detail.name === "privateIPv4Address") {
                    privateIPv4Address = detail.value;
                }
            }

            if (privateIPv4Address) {
                break;
            }
        }

        if (privateIPv4Address) {
            selectedTask = task;
        }
    }

    if (!selectedTask) {
        throw new McmaException("Failed to find a running task for service '" + benchmarksttServiceName + "'");
    }

    return privateIPv4Address;
}
