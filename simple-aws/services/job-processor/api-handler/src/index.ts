import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { McmaApiRouteCollection } from "@mcma/api";
import { ApiGatewayApiController } from "@mcma/aws-api-gateway";
import { AwsCloudWatchLoggerProvider } from "@mcma/aws-logger";

import { DataController } from "@local/job-processor";
import { JobRoutes } from "./job-routes";
import { JobExecutionRoutes } from "./job-execution-routes";

const { TableName, PublicUrl, LogGroupName } = process.env;

const loggerProvider = new AwsCloudWatchLoggerProvider("job-processor-api-handler", LogGroupName);

const dataController = new DataController(TableName, PublicUrl);
const jobRoutes = new JobRoutes(dataController);
const jobExecutionRoutes = new JobExecutionRoutes(dataController);

const routes = new McmaApiRouteCollection().addRoutes(jobRoutes).addRoutes(jobExecutionRoutes);

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
