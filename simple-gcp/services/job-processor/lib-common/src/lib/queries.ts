import { JobBaseProperties, JobStatus } from "@mcma/core";
import { FilterCriteria, FilterExpression, Query } from "@mcma/data";

export type JobResourceQueryParameters = {
    path?: string;
    status?: JobStatus;
    from?: Date;
    to?: Date;
    ascending?: boolean;
    limit?: number;
}

export function buildQuery<T extends JobBaseProperties>(queryParameters: JobResourceQueryParameters, pageStartToken: string): Query<T> {
    const { path, status, from, to, ascending, limit } = queryParameters;

    const filterExpressions: FilterExpression<T>[] = [];

    if (status !== null && status !== undefined) {
        filterExpressions.push(new FilterCriteria("status", "=", status));
    }

    if (from !== null && from !== undefined) {
        filterExpressions.push(new FilterCriteria("dateCreated", ">=", from));
    }

    if (to !== null && to !== undefined) {
        filterExpressions.push(new FilterCriteria("dateCreated", "<=", to));
    }

    return {
        path,
        sortBy: "dateCreated",
        sortAscending: ascending ?? false,
        pageSize: limit,
        pageStartToken: pageStartToken,
        filterExpression: {
            logicalOperator: "&&",
            children: filterExpressions
        }
    };
}