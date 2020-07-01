import { v4 as uuidv4 } from "uuid";

import { Job, JobBase, JobExecution, JobStatus, Utils } from "@mcma/core";
import { DynamoDB } from "aws-sdk";
import { types } from "util";

export class DataController {
    private dc: DynamoDB.DocumentClient;

    constructor(public tableName: string, private publicUrl: string, private consistentRead?: boolean) {
        this.dc = new DynamoDB.DocumentClient();
    }

    private serialize<T extends any>(object: T): T {
        if (object) {
            for (const key of Object.keys(object)) {
                const value = object[key];
                if (types.isDate(value)) {
                    if (isNaN(value.getTime())) {
                        delete object[key];
                    } else {
                        object[key] = value.toISOString();
                    }
                } else if (typeof value === "object") {
                    object[key] = this.serialize(value);
                }
            }
        }
        return object;
    }

    private deserialize<T extends any>(object: T): T {
        if (object) {
            for (const key of Object.keys(object)) {
                const value = object[key];
                if (Utils.isValidDateString(value)) {
                    object[key] = new Date(value);
                } else if (typeof value === "object") {
                    object[key] = this.deserialize(value);
                }
            }
        }
        return object;
    }

    private extractJobGuid(id: string): string {
        const startIdx = id.indexOf("/jobs/") + 6;
        return id.substr(startIdx, 36);
    }

    private async queryResources<T>(partitionKey: string, status?: JobStatus, from?: Date, to?: Date, ascending?: boolean, limit?: number): Promise<T[]> {
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

        const params: DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            IndexName: index,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ScanIndexForward: ascending,
            Limit: limit
        };

        const list = [];

        do {
            const data = await this.dc.query(params).promise();

            for (const item of data.Items) {
                list.push(this.deserialize(item.resource));
            }

            params.Limit -= data.Count;
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (params.ExclusiveStartKey && params.Limit > 0);

        return list;
    }

    private async putResource<T>(partitionKey: string, resource: JobBase<T>): Promise<JobBase<T>> {
        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: {
                resource_pkey: partitionKey,
                resource_id: resource.id,
                resource_status: `${partitionKey}-${resource.status}`,
                resource_created: resource.dateCreated.getTime(),
                resource: this.serialize(resource),
            }
        };

        await this.dc.put(params).promise();

        return this.deserialize(resource);
    }

    private async getResource<T>(partitionKey: string, resourceId: string): Promise<T> {
        const params: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: {
                resource_pkey: partitionKey,
                resource_id: resourceId,
            },
            ConsistentRead: this.consistentRead,
        };

        const data = await this.dc.get(params).promise();

        if (data.Item?.resource) {
            return this.deserialize(data.Item?.resource);
        }

        return null;
    }

    private async deleteResource(partitionKey: string, resourceId: string): Promise<void> {
        const params: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: {
                resource_pkey: partitionKey,
                resource_id: resourceId,
            }
        };

        await this.dc.delete(params).promise();
    }

    async queryJobs(status?: JobStatus, from?: Date, to?: Date, ascending?: boolean, limit?: number): Promise<Job[]> {
        return this.queryResources<Job>("Job", status, from, to, ascending, limit);
    }

    async addJob(job: Job): Promise<Job> {
        job.id = this.publicUrl + "/jobs/" + uuidv4();
        job.dateCreated = job.dateModified = new Date();

        await this.putResource("Job", job);
        return job;
    }

    async updateJob(job: Job): Promise<Job> {
        job.dateModified = new Date();
        await this.putResource("Job", job);
        return job;
    }

    async getJob(jobId: string): Promise<Job> {
        return this.getResource<Job>("Job", jobId);
    }

    async deleteJob(jobId: string): Promise<void> {
        await this.deleteResource("Job", jobId);
    }

    async queryExecutions(jobId: string, status?: JobStatus, from?: Date, to?: Date, ascending?: boolean, limit?: number): Promise<JobExecution[]> {
        const jobGuid = this.extractJobGuid(jobId);
        return this.queryResources(`JobExecution-${jobGuid}`, status, from, to, ascending, limit);
    }

    async getExecutions(jobId: string): Promise<JobExecution[]> {
        const jobGuid = this.extractJobGuid(jobId);

        const params: DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            KeyConditionExpression:  "resource_pkey = :pkey",
            ExpressionAttributeValues: {
                ":pkey": `JobExecution-${jobGuid}`
            },
            ConsistentRead: this.consistentRead,
            ScanIndexForward: false,
        };

        const list = [];

        do {
            const data = await this.dc.query(params).promise();

            for (const item of data.Items) {
                list.push(this.deserialize(item.resource));
            }

            params.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (params.ExclusiveStartKey);

        return list;
    }

    async addExecution(jobId: string, jobExecution: JobExecution): Promise<JobExecution> {
        const jobGuid = this.extractJobGuid(jobId);

        const executions = await this.getExecutions(jobId);

        jobExecution.id = `${jobId}/executions/${(executions.length + 1)}`;
        jobExecution.dateCreated = jobExecution.dateModified = new Date();

        await this.putResource(`JobExecution-${jobGuid}`, jobExecution);

        return jobExecution;
    }

    async getExecution(jobExecutionId: string): Promise<JobExecution> {
        const jobGuid = this.extractJobGuid(jobExecutionId);

        return this.getResource<JobExecution>(`JobExecution-${jobGuid}`, jobExecutionId);
    }

    async updateExecution(jobExecution: JobExecution): Promise<JobExecution> {
        const jobGuid = this.extractJobGuid(jobExecution.id);

        jobExecution.dateModified = new Date();

        await this.putResource(`JobExecution-${jobGuid}`, jobExecution);

        return jobExecution;
    }

    async deleteExecution(jobExecutionId: string) {
        const jobGuid = this.extractJobGuid(jobExecutionId);

        return this.deleteResource(`JobExecution-${jobGuid}`, jobExecutionId);
    }
}
