import { JobStatus } from "@mcma/core";
import { JobResourceQueryParameters } from "@local/job-processor";

export function buildQueryParameters(queryStringParameters: { [key: string]: any }, fallbackLimit?: number): JobResourceQueryParameters {
    const status = <JobStatus>queryStringParameters.status;

    let from = new Date(queryStringParameters.from);
    if (isNaN(from.getTime())) {
        from = undefined;
    }

    let to = new Date(queryStringParameters.to);
    if (isNaN(to.getTime())) {
        to = undefined;
    }

    let ascending = queryStringParameters.order === "asc";

    let limit = Number.parseInt(queryStringParameters.limit);
    if (isNaN(limit) || limit <= 0) {
        limit = undefined;
    }

    if ((limit === undefined || limit === null) && fallbackLimit) {
        // setting limit to default value of 100 if no other limitation is set
        if ((from === undefined || from === null) &&
            (to === undefined || to === null)) {
            limit = fallbackLimit;
        }
    }

    return {
        status,
        from,
        to,
        ascending,
        limit
    };
}