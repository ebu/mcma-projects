import { DocumentDatabaseTable, DocumentDatabaseTableProvider, QueryResults } from "@mcma/data";

import { McmaResource, McmaResourceProperties } from "@mcma/core";

export class DataController {
    private dbTable: DocumentDatabaseTable;

    constructor(private tableName: string, private publicUrl: string, private dbTableProvider: DocumentDatabaseTableProvider) {}

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

    async put<T extends McmaResource>(id: string, resource: T): Promise<T> {
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
