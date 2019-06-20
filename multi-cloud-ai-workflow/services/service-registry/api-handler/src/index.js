//"use strict";
const { Service, JobProfile, Logger } = require("mcma-core");
const { McmaApiRouteCollection } = require("mcma-api");
const { awsDefaultRoutes } = require("mcma-aws");

const controller =
    new McmaApiRouteCollection()
        .addRoutes(awsDefaultRoutes(Service).withDynamoDb().addAll().build())
        .addRoutes(awsDefaultRoutes(JobProfile).withDynamoDb().addAll().build())
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(request);
    Logger.debug(event);

    const resp = await controller.handleRequest(event, context);
    Logger.debug(resp);
    return resp;
}
