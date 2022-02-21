import { APIGatewayEventDefaultAuthorizerContext, APIGatewayEventRequestContextWithAuthorizer, Context, DynamoDBStreamEvent } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { Query } from "@mcma/data";
import { McmaResource } from "@mcma/core";

const { LogGroupName, TableName } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-db-trigger", LogGroupName, new AWS.CloudWatchLogs());
const dbTableProvider = new DynamoDbTableProvider({}, new AWS.DynamoDB());

export async function handler(event: DynamoDBStreamEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const messages: any = [];

        for (const record of event.Records) {
            if (record.dynamodb?.Keys?.resource_pkey?.S === "/connections") {
                continue;
            }

            const newResource = record.dynamodb.NewImage ? <McmaResource>AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage).resource : null;
            const oldResource = record.dynamodb.OldImage ? <McmaResource>AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage).resource : null;

            let operation: string;
            switch (record.eventName) {
                case "INSERT":
                    operation = "Insert";
                    logger.info(newResource);
                    break;
                case "MODIFY":
                    operation = "Update";
                    logger.info(newResource);
                    break;
                case "REMOVE":
                    operation = "Delete";
                    break;
                default:
                    operation = record.eventName;
                    break;
            }

            const resource = newResource ?? oldResource;

            messages.push({
                operation,
                resource
            });
        }

        logger.info(`Detected ${messages.length} message(s) for sending to websocket clients`);

        if (messages.length > 0) {
            const table = await dbTableProvider.get(TableName);

            const connections = [];

            const queryParams: Query<APIGatewayEventRequestContextWithAuthorizer<APIGatewayEventDefaultAuthorizerContext>> = {
                path: "/connections",
                pageStartToken: undefined,
            };

            do {
                const queryResults = await table.query(queryParams);
                connections.push(...queryResults.results);
                queryParams.pageStartToken = queryResults.nextPageStartToken;
            } while (queryParams.pageStartToken);

            logger.info(connections);

            logger.info(`Found ${connections.length} open websocket connection(s)`);
            if (connections.length > 0) {
                const postCalls = connections.map(async (connection) => {
                    const managementApi = new AWS.ApiGatewayManagementApi({
                        endpoint: connection.domainName + "/" + connection.stage
                    });

                    try {
                        for (const message of messages) {
                            await managementApi.postToConnection({
                                ConnectionId: connection.connectionId,
                                Data: JSON.stringify(message),
                            }).promise();
                        }
                    } catch (e) {
                        if (e.statusCode === 410) {
                            logger.info("Removing stale connection " + connection.connectionId);
                            await table.delete("/connections/" + connection.connectionId);
                        } else {
                            throw e;
                        }
                    }
                });

                await Promise.all(postCalls);
            }
        }
    } catch (error) {
        logger.error(error);
        throw error;
    } finally {
        logger.functionEnd(context.awsRequestId);

        console.log("LoggerProvider.flush - START - " + new Date().toISOString());
        const t1 = Date.now();
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
        const t2 = Date.now();
        console.log("LoggerProvider.flush - END   - " + new Date().toISOString() + " - flush took " + (t2 - t1) + " ms");
    }
}
