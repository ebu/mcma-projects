import { JobStatus } from "@mcma/core";
import { QueryInput } from "aws-sdk/clients/dynamodb";
import { CustomQuery, Document } from "@mcma/data";

export type JobResourceQueryParameters = {
    partitionKey?: string;
    status?: JobStatus;
    from?: Date;
    to?: Date;
    ascending?: boolean;
    limit?: number;
}

export function createJobResourceQuery(customQuery: CustomQuery<Document, JobResourceQueryParameters>): QueryInput {
    let { partitionKey, status, from, to, ascending, limit } = customQuery.parameters;
    ascending = !!ascending;
    if (limit === null) {
        limit = undefined;
    }

    const index = status ? "ResourceStatusIndex" : "ResourceCreatedIndex";
    const partitionKeyField = status ? "resource_status" : "resource_pkey";
    const partitionKeyValue = status ? `${partitionKey}-${status}` : partitionKey;
    let keyConditionExpression = `${partitionKeyField} = :pkey`;
    const expressionAttributeValues: any = {
        ":pkey": partitionKeyValue
    };

    if ((from !== undefined && from !== null) &&
        (to !== undefined && to !== null)) {
        keyConditionExpression += " and resource_created BETWEEN :from AND :to";
        expressionAttributeValues[":from"] = from.getTime();
        expressionAttributeValues[":to"] = to.getTime();
    } else if (from !== undefined && from !== null) {
        keyConditionExpression += " and resource_created >= :from";
        expressionAttributeValues[":from"] = from.getTime();
    } else if (to !== undefined && to !== null) {
        keyConditionExpression += " and resource_created <= :to";
        expressionAttributeValues[":to"] = to.getTime();
    }

    return {
        TableName: null,
        IndexName: index,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ScanIndexForward: ascending,
        Limit: limit
    };
}