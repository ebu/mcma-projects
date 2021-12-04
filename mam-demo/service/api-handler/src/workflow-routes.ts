import { DefaultRouteCollection, HttpStatusCode } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaWorkflow, MediaWorkflowProperties } from "@local/model";

export function buildWorkflowRoutes(dbTableProvider: DynamoDbTableProvider) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaWorkflow, "/workflows");

    routes.create.onStarted = async requestContext => {
        let properties = requestContext.getRequestBody<MediaWorkflowProperties>();
        if (!properties) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return false;
        }

        let resource: MediaWorkflow;
        try {
            resource = new MediaWorkflow(properties);
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

