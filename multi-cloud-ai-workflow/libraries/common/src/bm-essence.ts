import { McmaResource, McmaResourceProperties } from "@mcma/core";
import { AwsS3FileLocator } from "@mcma/aws-s3";

export interface BMEssenceProperties extends McmaResourceProperties {
    bmContent?: string;
    title?: string;
    description?: string;
    locations?: AwsS3FileLocator[];
    technicalMetadata?: any;
}

export class BMEssence extends McmaResource implements BMEssenceProperties {
    bmContent?: string;
    title?: string;
    description?: string;
    locations?: AwsS3FileLocator[];
    technicalMetadata?: any;

    constructor(properties: BMEssenceProperties) {
        super("BMEssence", properties);
    }
}
