//"use strict";
const { BMContent, BMEssence, Logger } = require("@mcma/core");
const { McmaApiRouteCollection, DefaultRouteCollectionBuilder } = require("@mcma/api");
const { DynamoDbTableProvider } = require("@mcma/aws-dynamodb");
require("@mcma/aws-api-gateway");

const contentDbTableProvider = new DynamoDbTableProvider(BMContent);
const essenceDbTableProvider = new DynamoDbTableProvider(BMEssence);

const controller =
    new McmaApiRouteCollection()
        .addRoutes(new DefaultRouteCollectionBuilder(contentDbTableProvider, BMContent, "bm-contents").addAll().build())
        .addRoutes(new DefaultRouteCollectionBuilder(essenceDbTableProvider, BMEssence, "bm-essences").addAll().build())
        .toApiGatewayApiController();

exports.handler = async (event, context) => {
    Logger.debug(JSON.stringify(event, null, 2),JSON.stringify(event, null, 2));

    const resp = await controller.handleRequest(event, context);
    Logger.debug(resp);
    return resp;
}
