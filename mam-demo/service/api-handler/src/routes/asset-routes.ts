import { DefaultRouteCollection, HttpStatusCode } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaAsset, MediaAssetProperties } from "@local/model";

export function buildAssetRoutes(dbTableProvider: DynamoDbTableProvider) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAsset, "/assets");

    routes.create.onStarted = async requestContext => {
        let properties = requestContext.getRequestBody<MediaAssetProperties>();
        if (!properties) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return false;
        }

        let resource: MediaAsset;
        try {
            resource = new MediaAsset(properties);
        } catch (error) {
            requestContext.getLogger()?.error(error);
            requestContext.setResponseError(HttpStatusCode.BadRequest, error.message);
            return false;
        }

        requestContext.request.body = resource;

        return true;
    };


    return routes;
}

