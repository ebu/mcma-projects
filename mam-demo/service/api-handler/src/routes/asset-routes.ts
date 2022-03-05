import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaAsset } from "@local/model";

export function buildAssetRoutes(dbTableProvider: DynamoDbTableProvider) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAsset, "/assets");

    routes.remove("create");
    routes.remove("update");

    return routes;
}

