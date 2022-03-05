import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { DefaultRouteCollection } from "@mcma/api";
import { getTableName } from "@mcma/data";

import { MediaAssetWorkflow } from "@local/model";
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

    routes.remove("create");
    routes.remove("update");

    return routes;
}
