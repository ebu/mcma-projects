import { QAJob } from "@mcma/core";
import { ProcessJobAssignmentHelper, ProviderCollection } from "@mcma/worker";

export async function benchmarkstt(providers: ProviderCollection, jobAssignmentHelper: ProcessJobAssignmentHelper<QAJob>) {
    const logger = jobAssignmentHelper.getLogger();


    await jobAssignmentHelper.fail("Not Implemented");
}
