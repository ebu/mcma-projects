import { DocumentDatabaseTable, QueryResults } from "@mcma/data";
import { DynamoDB } from "aws-sdk";

import { McmaResourceProperties } from "@mcma/core";
import { DynamoDbTableOptions, DynamoDbTableProvider } from "@mcma/aws-dynamodb";

export function getDynamoDbOptions(consistentRead: boolean): DynamoDbTableOptions {
    return {
        topLevelAttributeMappings: {
            dateCreated: (partitionKey, sortKey, resource) => new Date(resource.dateCreated).getTime()
        },
        consistentGet: consistentRead,
        consistentQuery: consistentRead
    };
}

export class DataController {
    private dbTableProvider: DynamoDbTableProvider;
    private dbTable: DocumentDatabaseTable;

    constructor(private tableName: string, private publicUrl: string, consistentRead: boolean, dynamoDB: DynamoDB) {
        this.dbTableProvider = new DynamoDbTableProvider(getDynamoDbOptions(consistentRead), dynamoDB);
    }

    private async init() {
        if (!this.dbTable) {
            this.dbTable = await this.dbTableProvider.get(this.tableName);
        }
        return this.dbTable;
    }

    async query<T extends McmaResourceProperties>(path: string, pageSize?: number, pageStartToken?: string): Promise<QueryResults<T>> {
        await this.init();
        if (path.startsWith(this.publicUrl)) {
            path = path.substring(this.publicUrl.length);
        }
        return this.dbTable.query<T>({ path, pageSize, pageStartToken });
    }

    async get<T extends McmaResourceProperties>(id: string): Promise<T> {
        await this.init();
        if (id.startsWith(this.publicUrl)) {
            id = id.substring(this.publicUrl.length);
        }
        return this.dbTable.get<T>(id);
    }

    async put<T extends McmaResourceProperties>(id: string, resource: T): Promise<T> {
        await this.init();
        if (id.startsWith(this.publicUrl)) {
            id = id.substring(this.publicUrl.length);
        }
        resource.id = this.publicUrl + id;
        resource.dateModified = new Date();
        if (!resource.dateCreated) {
            resource.dateCreated = resource.dateModified;
        }
        return this.dbTable.put<T>(id, resource);
    }

    async delete(id: string): Promise<void> {
        await this.init();
        if (id.startsWith(this.publicUrl)) {
            id = id.substring(this.publicUrl.length);
        }
        return this.dbTable.delete(id);
    }
}
