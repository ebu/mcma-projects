import { DefaultRouteCollection, HttpStatusCode } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { AudioEssence, ImageEssence, MediaEssence, MediaEssenceProperties, VideoEssence } from "@local/model";
import { getTableName } from "@mcma/data";

import { parentResourceExists } from "./utils";

export function buildAssetEssenceRoutes(dbTableProvider: DynamoDbTableProvider) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaEssence, "/assets/{assetId}/essences");

    routes.query.onStarted = async requestContext => {
        let table = await dbTableProvider.get(getTableName(requestContext.configVariables));
        if (!await parentResourceExists(requestContext.request.path, table)) {
            requestContext.setResponseResourceNotFound();
            return false;
        }

        return true;
    };

    routes.create.onStarted = async requestContext => {
        let table = await dbTableProvider.get(getTableName(requestContext.configVariables));
        if (!await parentResourceExists(requestContext.request.path, table)) {
            requestContext.setResponseResourceNotFound();
            return false;
        }

        let properties = requestContext.getRequestBody<MediaEssenceProperties>();
        if (!properties) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return false;
        }

        let resource: MediaEssence;
        try {
            switch (properties["@type"]) {
                case "VideoEssence":
                    resource = new VideoEssence(properties);
                    break;
                case "AudioEssence":
                    resource = new AudioEssence(properties);
                    break;
                case "ImageEssence":
                    resource = new ImageEssence(properties);
                    break;
                default:
                    resource = new MediaEssence(properties);
                    break;
            }
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

