import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";

import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

const { CloudWatchEventRule, LogGroupName, TableName } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const loggerProvider = new AwsCloudWatchLoggerProvider("mam-service-websocket-handler", LogGroupName, new AWS.CloudWatchLogs());
const dbTableProvider = new DynamoDbTableProvider({}, new AWS.DynamoDB());

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        const table = await dbTableProvider.get(TableName);

        switch (event.requestContext.routeKey) {
            case "$connect":
                await table.put("/connections/" + event.requestContext.connectionId, event.requestContext);

                const cloudWatchEvents = new AWS.CloudWatchEvents();
                await cloudWatchEvents.enableRule({ Name: CloudWatchEventRule }).promise();
                break;
            case "$disconnect":
                await table.delete("/connections/" + event.requestContext.connectionId);
                break;
            case "message":
                break;
            default:
                logger.warn(`Unexpected route: ${event.requestContext.routeKey}`);
                break;
        }

        return {
            statusCode: 200
        };
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


