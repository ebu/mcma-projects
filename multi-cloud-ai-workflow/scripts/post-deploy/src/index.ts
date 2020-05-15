import * as fs from "fs";
import * as AWS from "aws-sdk";
import * as node_fetch from "node-fetch";

import { updateServiceRegistry } from "./update-service-registry";
import { createCognitoUser } from "./create-cognito-user";
import { uploadWebsiteConfig } from "./upload-website-config";

const AWS_CREDENTIALS = "../../deployment/aws-credentials.json";
const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

AWS.config.loadFromPath(AWS_CREDENTIALS);

global["fetch"] = node_fetch;

async function main() {
    try {
        const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));

        await uploadWebsiteConfig(AWS, terraformOutput);

        await createCognitoUser(AWS, terraformOutput);

        const resourceManager = await updateServiceRegistry(AWS, terraformOutput);


    } catch (error) {
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(() => console.log("Done"));
