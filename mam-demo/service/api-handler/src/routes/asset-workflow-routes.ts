import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { DefaultRouteCollection, HttpStatusCode } from "@mcma/api";
import { getTableName } from "@mcma/data";

import { MediaAssetWorkflow, MediaAssetWorkflowProperties } from "@local/model";
import { parentResourceExists } from "./utils";

export function buildAssetWorkflowRoutes(dbTableProvider: DynamoDbTableProvider) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAssetWorkflow, "/assets/{assetId}/workflows");

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

        let properties = requestContext.getRequestBody<MediaAssetWorkflowProperties>();
        if (!properties) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return false;
        }

        let resource: MediaAssetWorkflow;
        try {
            resource = new MediaAssetWorkflow(properties);
        } catch (error) {
            requestContext.getLogger()?.error(error);
            requestContext.setResponseStatusCode(HttpStatusCode.BadRequest, error.message);
            return false;
        }

        requestContext.request.body = resource;

        return true;
    };

    routes.remove("update");

    return routes;
}
