 import { McmaObject } from "@mcma/core";

export interface DescriptiveMetadataProperties {
    name?: string;
    description?: string;
}

export class DescriptiveMetadata extends McmaObject {
    name?: string;
    description?: string;

    constructor(properties: DescriptiveMetadataProperties) {
        super("DescriptiveMetadata", properties);
    }
}