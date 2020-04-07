import { EC2, ECS, S3 } from "aws-sdk";

import { Client as RpcClient } from "node-json-rpc2";

import { v4 as uuidv4 } from "uuid";

import { EnvironmentVariableProvider, Exception, ILogger, QAJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";
import { AwsS3FileLocator } from "@mcma/aws-s3";

export async function benchmarkstt(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<QAJob>) {
    const logger = jobAssignmentHelper.getLogger();
    const environmentVariableProvider = providers.getEnvironmentVariableProvider();

    const jobInput = jobAssignmentHelper.getJobInput();
    const inputFile = <AwsS3FileLocator>jobInput.inputFile;
    const referenceFile = <AwsS3FileLocator>jobInput.referenceFile;
    const outputLocation = jobInput.outputLocation;

    if (!inputFile.awsS3Bucket || !inputFile.awsS3Key) {
        throw new Exception("Failed to find awsS3Bucket and/or awsS3Key properties on inputFile:\n" + JSON.stringify(inputFile, null, 2));
    }
    if (!referenceFile.awsS3Bucket || !referenceFile.awsS3Key) {
        throw new Exception("Failed to find awsS3Bucket and/or awsS3Key properties on referenceFile:\n" + JSON.stringify(referenceFile, null, 2));
    }

    const s3 = new S3();
    const inputFileObject = await s3.getObject({
        Bucket: inputFile.awsS3Bucket,
        Key: inputFile.awsS3Key,
    }).promise();
    const inputText = inputFileObject.Body.toString();

    const referenceFileObject = await s3.getObject({
        Bucket: referenceFile.awsS3Bucket,
        Key: referenceFile.awsS3Key,
    }).promise();
    const referenceText = referenceFileObject.Body.toString();

    logger.info("Obtaining service ip address");
    const ipAddress = await getServiceIpAddress(environmentVariableProvider, logger);
    logger.info("IP Address: " + ipAddress);

    logger.info("Sending request to benchmarkstt service");
    const result = await invokeBenchmarksttService(ipAddress, inputText, referenceText, environmentVariableProvider, logger);
    logger.info(result);

    const putObjectParams = {
        Bucket: outputLocation.awsS3Bucket,
        Key: (outputLocation.awsS3KeyPrefix ? outputLocation.awsS3KeyPrefix : "") + uuidv4() + ".json",
        Body: JSON.stringify(result)
    };
    await s3.putObject(putObjectParams).promise();

    logger.info("Updating jobAssignment with job output");
    jobAssignmentHelper.getJobOutput().outputFile = new AwsS3FileLocator({
        awsS3Bucket: putObjectParams.Bucket,
        awsS3Key: putObjectParams.Key
    });
    logger.info(jobAssignmentHelper.getJobOutput().outputFile);

    await jobAssignmentHelper.complete();
}

async function invokeBenchmarksttService(ipAddress: string, inputText: string, referenceText: string, environmentVariableProvider: EnvironmentVariableProvider, logger: ILogger): Promise<any> {

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

    return new Promise<any>((resolve, reject) => {
        client.call(request, (error, result) => {
            if (error) {
                return reject(error);
            }
            resolve(result);
        });
    });
}

async function getServiceIpAddress(environmentVariableProvider: EnvironmentVariableProvider, logger: ILogger): Promise<string> {
    const clusterName = environmentVariableProvider.getRequiredContextVariable("EcsClusterName");
    const benchmarksttServiceName = environmentVariableProvider.getRequiredContextVariable("EcsBenchmarksttServiceName");

    const ecs = new ECS();
    const ec2 = new EC2();

    logger.info("Listing tasks for cluster '" + clusterName + "' and service '" + benchmarksttServiceName + "'");
    const listTaskData = await ecs.listTasks({
        cluster: clusterName,
        serviceName: benchmarksttServiceName
    }).promise();
    logger.info(listTaskData);

    logger.info("Describing tasks");
    const describeTaskData = await ecs.describeTasks({
        cluster: clusterName,
        tasks: listTaskData.taskArns,
    }).promise();
    logger.info(describeTaskData);

    logger.info("Determining suitable task to invoke");
    let selectedTask = undefined;
    let privateIPv4Address = undefined;
    let networkInterfaceId = undefined;

    for (const task of describeTaskData.tasks) {
        logger.info("lastStatus = " + task.lastStatus);
        if (task.lastStatus !== "RUNNING") {
            continue;
        }
        for (const attachment of task.attachments) {
            logger.info("attachment.type = " + attachment.type);
            logger.info("attachment.status = " + attachment.status);
            if (attachment.type !== "ElasticNetworkInterface" || attachment.status !== "ATTACHED") {
                continue;
            }

            privateIPv4Address = undefined;
            networkInterfaceId = undefined;
            for (const detail of attachment.details) {
                logger.info(detail);

                switch (detail.name) {
                    case "networkInterfaceId":
                        networkInterfaceId = detail.value;
                        break;
                    case "privateIPv4Address":
                        privateIPv4Address = detail.value;
                        break;
                }
            }

            if (privateIPv4Address && networkInterfaceId) {
                break;
            }
        }

        logger.info({ networkInterfaceId, privateIPv4Address });

        if (privateIPv4Address && networkInterfaceId) {
            selectedTask = task;
        }
    }

    if (!selectedTask) {
        throw new Exception("Failed to find a running task for service '" + benchmarksttServiceName + "'");
    }

    logger.info("Obtaining public IP address for service '" + benchmarksttServiceName + "'");
    const describeNetworkInterfacesData = await ec2.describeNetworkInterfaces({
        NetworkInterfaceIds: [networkInterfaceId]
    }).promise();
    logger.info(describeNetworkInterfacesData);

    let publicIp = describeNetworkInterfacesData.NetworkInterfaces[0]?.Association?.PublicIp;
    if (!publicIp) {
        throw new Exception("Failed to find public IP address for service '" + benchmarksttServiceName + "'");
    }
    return publicIp;
}
