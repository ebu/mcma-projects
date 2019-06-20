//"use strict";
const { BMContent, BMEssence, Logger } = require("mcma-core");
const { McmaApiRouteCollection } = require("mcma-api");
const { awsDefaultRoutes } = require("mcma-aws");

const controller =
    new McmaApiRouteCollection()
        .addRoutes(awsDefaultRoutes(BMContent).withDynamoDb("bm-contents").addAll().build())
        .addRoutes(awsDefaultRoutes(BMEssence).withDynamoDb("bm-essence").addAll().build())
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(request);
    Logger.debug(event);

    const resp = await controller.handleRequest(event, context);
    Logger.debug(resp);
    return resp;
}
