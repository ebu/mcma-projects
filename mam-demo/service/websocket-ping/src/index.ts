import { APIGatewayEventDefaultAuthorizerContext, APIGatewayEventRequestContextWithAuthorizer, Context, ScheduledEvent } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { Query } from "@mcma/data";

const { CloudWatchEventRule, LogGroupName, TableName } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-websocket-ping", LogGroupName, new AWS.CloudWatchLogs());
const dbTableProvider = new DynamoDbTableProvider({}, new AWS.DynamoDB());

export async function handler(event: ScheduledEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const cloudWatchEvents = new AWS.CloudWatchEvents();
        await cloudWatchEvents.disableRule({ Name: CloudWatchEventRule }).promise();

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
            try {
                const postCalls = connections.map(async (connection) => {
                    const managementApi = new AWS.ApiGatewayManagementApi({
                        endpoint: connection.domainName + "/" + connection.stage
                    });

                    try {
                        await managementApi.postToConnection({
                            ConnectionId: connection.connectionId,
                            Data: JSON.stringify({ operation: "Ping" }),
                        }).promise();
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
            } finally {
                const cloudWatchEvents = new AWS.CloudWatchEvents();
                await cloudWatchEvents.enableRule({ Name: CloudWatchEventRule }).promise();
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
