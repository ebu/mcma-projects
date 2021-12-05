import * as fs from "fs";
import * as AWS from "aws-sdk";
import { GetInvalidationResult } from "aws-sdk/clients/cloudfront";
import { Utils } from "@mcma/core";

const TERRAFORM_OUTPUT = "../../deployment/terraform.output.json";

const { AwsProfile, AwsRegion } = process.env;

AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: AwsProfile });
AWS.config.region = AwsRegion;

const cloudFront = new AWS.CloudFront();

export function log(entry?: any) {
    if (typeof entry === "object") {
        console.log(JSON.stringify(entry, null, 2));
    } else {
        console.log(entry);
    }
}

async function invalidateCloudFront(cloudfrontDistributionId: string, websiteUrl: string) {
    if (cloudfrontDistributionId) {
        log(`Invalidating CloudFront Distribution ${cloudfrontDistributionId} for '${websiteUrl}'`);
        const response = await cloudFront.createInvalidation({
            DistributionId: cloudfrontDistributionId,
            InvalidationBatch: {
                Paths: {
                    Quantity: 1,
                    Items: ["/*"]
                },
                CallerReference: new Date().toISOString()
            }
        }).promise();

        let getInvalidationResponse: GetInvalidationResult;
        do {
            await Utils.sleep(5000);
            getInvalidationResponse = await cloudFront.getInvalidation({
                Id: response.Invalidation.Id,
                DistributionId: cloudfrontDistributionId,
            }).promise();

            log(`Invalidating CloudFront Distribution ${cloudfrontDistributionId} for '${websiteUrl}' - ${getInvalidationResponse.Invalidation.Status}`);
        } while (getInvalidationResponse.Invalidation.Status !== "Completed");
    }
}

async function main() {
    try {
        const terraformOutput = JSON.parse(fs.readFileSync(TERRAFORM_OUTPUT, "utf8"));

        const websiteCloudfrontDistributionId = terraformOutput.website?.value?.cloudfront_distribution_id;
        const websiteUrl = terraformOutput.website?.value?.url;

        await invalidateCloudFront(websiteCloudfrontDistributionId, websiteUrl);
    } catch (error) {
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

main().then(() => console.log("Done"));
