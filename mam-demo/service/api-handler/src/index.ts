import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { buildAssetRoutes } from "./asset-routes";
import { buildAssetEssenceRoutes } from "./asset-essence-routes";
import { buildAssetWorkflowRoutes } from "./asset-workflow-routes";
import { buildWorkflowRoutes } from "./workflow-routes";

const { LogGroupName } = process.env;

const AWS = AWSXRay.captureAWS(require("aws-sdk"));

const loggerProvider = new AwsCloudWatchLoggerProvider("service-api-handler", LogGroupName, new AWS.CloudWatchLogs());
const dbTableProvider = new DynamoDbTableProvider({}, new AWS.DynamoDB());

const routes = new McmaApiRouteCollection();
routes.addRoutes(buildAssetRoutes(dbTableProvider));
routes.addRoutes(buildAssetEssenceRoutes(dbTableProvider));
routes.addRoutes(buildAssetWorkflowRoutes(dbTableProvider));
routes.addRoutes(buildWorkflowRoutes(dbTableProvider));

const restController = new ApiGatewayApiController(routes, loggerProvider);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
    console.log(JSON.stringify(event, null, 2));
    console.log(JSON.stringify(context, null, 2));

    const logger = loggerProvider.get(context.awsRequestId);
    try {
        logger.functionStart(context.awsRequestId);
        logger.debug(event);
        logger.debug(context);

        return await restController.handleRequest(event, context);
    } finally {
        logger.functionEnd(context.awsRequestId);

        console.log("LoggerProvider.flush - START - " + new Date().toISOString());
        const t1 = Date.now();
        await loggerProvider.flush(Date.now() + context.getRemainingTimeInMillis() - 5000);
        const t2 = Date.now();
        console.log("LoggerProvider.flush - END   - " + new Date().toISOString() + " - flush took " + (t2 - t1) + " ms");
    }
}
