import * as fs from "fs";
import * as node_fetch from "node-fetch";

import { updateServiceRegistry } from "./update-service-registry";
import { createResourceManager } from "./create-resource-manager";

const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

global["fetch"] = node_fetch;

async function main() {
    try {
        const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));

        const resourceManager = createResourceManager(terraformOutput);

        await updateServiceRegistry(resourceManager, terraformOutput);
    } catch (error) {
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(() => console.log("Done"));
