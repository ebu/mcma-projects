import { DefaultRouteCollection, HttpStatusCode, McmaApiRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";
import { getWorkerFunctionId, WorkerInvoker } from "@mcma/worker-invoker";
import { getTableName } from "@mcma/data";

import { MediaWorkflow, MediaWorkflowProperties } from "@local/model";

export function buildWorkflowRoutes(dbTableProvider: DynamoDbTableProvider, workerInvoker: WorkerInvoker): McmaApiRouteCollection {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaWorkflow, "/workflows");

    routes.create.onStarted = async function(requestContext) {
        const properties = requestContext.getRequestBody<MediaWorkflowProperties>();
        if (!properties) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return false;
        }

        let resource: MediaWorkflow;
        try {
            resource = new MediaWorkflow(properties);
        } catch (error) {
            requestContext.getLogger()?.error(error);
            requestContext.setResponseError(HttpStatusCode.BadRequest, error.message);
            return false;
        }

        requestContext.request.body = resource;

        return true;
    };

    routes.create.onCompleted = async function(requestContext, resource) {
        await workerInvoker.invoke(
            getWorkerFunctionId(requestContext.configVariables),
            {
                operationName: "StartWorkflow",
                input: {
                    mediaWorkflow: resource
                },
            }
        );
    };

    routes.remove("update");

    routes.addRoute("POST", "/workflows/{id}/notifications", async requestContext => {
        const request = requestContext.request;

        const table = await dbTableProvider.get(getTableName());

        const mediaWorkflowDatabaseId = "/workflows/" + request.pathVariables.id;

        const mediaWorkflow = await table.get(mediaWorkflowDatabaseId);
        if (!mediaWorkflow) {
            requestContext.setResponseResourceNotFound();
            return;
        }

        const notification = requestContext.getRequestBody();
        if (!notification) {
            requestContext.setResponseBadRequestDueToMissingBody();
            return;
        }

        await workerInvoker.invoke(
            getWorkerFunctionId(),
            {
                operationName: "ProcessNotification",
                input: {
                    mediaWorkflowDatabaseId,
                    notification
                },
                tracker: mediaWorkflow.tracker
            }
        );
    });

    return routes;
}
