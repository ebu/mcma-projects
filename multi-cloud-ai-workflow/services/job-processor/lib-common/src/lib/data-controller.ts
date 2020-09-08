import { v4 as uuidv4 } from "uuid";

import { Job, JobExecution } from "@mcma/core";
import { DocumentDatabaseMutex, DocumentDatabaseTable, QueryResults } from "@mcma/data";
import { createJobResourceQuery, JobResourceQueryParameters } from "./custom-queries";
import { DynamoDbTableOptions, DynamoDbTableProvider } from "@mcma/aws-dynamodb";

function extractPath(id: string): string {
    const startIdx = id.indexOf("/jobs/");
    return id.substr(startIdx);
}

function getDynamoDbOptions(consistentRead?: boolean): DynamoDbTableOptions {
    return {
        topLevelAttributeMappings: {
            resource_status: (partitionKey, sortKey, resource) => `${partitionKey}-${resource.status}`,
            resource_created: (partitionKey, sortKey, resource) => resource.dateCreated.getTime()
        },
        customQueryRegistry: {
            createJobResourceQuery
        },
        consistentGet: consistentRead,
        consistentQuery: consistentRead
    };
}

export class DataController {
    private dbTableProvider: DynamoDbTableProvider;
    private dbTable: DocumentDatabaseTable;

    constructor(private tableName: string, private publicUrl: string, consistentRead?: boolean) {
        this.dbTableProvider = new DynamoDbTableProvider(getDynamoDbOptions(consistentRead));
    }

    private async init() {
        if (!this.dbTable) {
            this.dbTable = await this.dbTableProvider.get(this.tableName);
        }
        return this.dbTable;
    }

    async queryJobs(queryParameters: JobResourceQueryParameters, pageStartToken?: string): Promise<QueryResults<Job>> {
        await this.init();

        queryParameters.partitionKey = "/jobs";

        return await this.dbTable.customQuery<Job, JobResourceQueryParameters>({
            name: createJobResourceQuery.name,
            parameters: queryParameters,
            pageStartToken
        });
    }

    async getJob(jobId: string): Promise<Job> {
        await this.init();
        const jobPath = extractPath(jobId);
        return await this.dbTable.get(jobPath);
    }

    async addJob(job: Job): Promise<Job> {
        await this.init();
        const jobPath = `/jobs/${uuidv4()}`;
        job.id = this.publicUrl + jobPath;
        job.dateCreated = job.dateModified = new Date();
        return await this.dbTable.put(jobPath, job);
    }

    async updateJob(job: Job): Promise<Job> {
        await this.init();
        const jobPath = extractPath(job.id);
        job.dateModified = new Date();
        return await this.dbTable.put(jobPath, job);
    }

    async deleteJob(jobId: string): Promise<void> {
        await this.init();
        const jobPath = extractPath(jobId);
        await this.dbTable.delete(jobPath);
    }

    async queryExecutions(jobId: string, queryParameters: JobResourceQueryParameters, pageStartToken?: string): Promise<QueryResults<JobExecution>> {
        await this.init();

        const jobPath = extractPath(jobId);
        queryParameters.partitionKey = `${jobPath}/executions`;

        return await this.dbTable.customQuery<JobExecution, JobResourceQueryParameters>({
            name: createJobResourceQuery.name,
            parameters: queryParameters,
            pageStartToken
        });
    }

    async getExecutions(jobId: string): Promise<QueryResults<JobExecution>> {
        await this.init();
        const jobPath = extractPath(jobId);

        return await this.dbTable.query({ path: jobPath });
    }

    async getExecution(jobExecutionId: string): Promise<JobExecution> {
        await this.init();
        const jobExecutionPath = extractPath(jobExecutionId);

        return await this.dbTable.get(jobExecutionPath);
    }

    async addExecution(jobId: string, jobExecution: JobExecution): Promise<JobExecution> {
        await this.init();
        const jobPath = extractPath(jobId);

        const executions = await this.getExecutions(jobId);
        const executionNumber = executions.results.length + 1;

        jobExecution.id = `${jobId}/executions/${executionNumber}`;
        jobExecution.dateCreated = jobExecution.dateModified = new Date();

        await this.dbTable.put(`${jobPath}/executions/${executionNumber}`, jobExecution);

        return jobExecution;
    }

    async updateExecution(jobExecution: JobExecution): Promise<JobExecution> {
        await this.init();
        const jobExecutionPath = extractPath(jobExecution.id);
        jobExecution.dateModified = new Date();
        await this.dbTable.put(jobExecutionPath, jobExecution);

        return jobExecution;
    }

    async deleteExecution(jobExecutionId: string) {
        await this.init();
        const jobExecutionPath = extractPath(jobExecutionId);

        return this.dbTable.delete(jobExecutionPath);
    }

    async createMutex(mutexName: string, mutexHolder: string): Promise<DocumentDatabaseMutex> {
        await this.init();
        return this.dbTable.createMutex(mutexName, mutexHolder);
    }
}
