import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaEssence } from "@local/model";
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

    routes.remove("create");
    routes.remove("update");

    return routes;
}

