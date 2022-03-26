import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { buildAssetEssenceRoutes, buildAssetRoutes, buildAssetWorkflowRoutes, buildWorkflowRoutes } from "./routes";
import { ConsoleLoggerProvider } from "@mcma/core";
import { LambdaWorkerInvoker } from "@mcma/aws-lambda-worker-invoker";

import { getDynamoDbOptions } from "@local/data";

const AWS = AWSXRay.captureAWS(require("aws-sdk"));
const s3 = new AWS.S3({ signatureVersion: "v4" });

const loggerProvider = new ConsoleLoggerProvider("mam-service-api-handler");
const dbTableProvider = new DynamoDbTableProvider(getDynamoDbOptions(false), new AWS.DynamoDB());
const workerInvoker = new LambdaWorkerInvoker(new AWS.Lambda());

const routes = new McmaApiRouteCollection();
routes.addRoutes(buildAssetRoutes(dbTableProvider, s3));
routes.addRoutes(buildAssetEssenceRoutes(dbTableProvider));
routes.addRoutes(buildAssetWorkflowRoutes(dbTableProvider));
routes.addRoutes(buildWorkflowRoutes(dbTableProvider, workerInvoker));

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
    }
}
