import { McmaObject, McmaObjectProperties } from "@mcma/core";

export interface DescriptiveMetadataProperties extends McmaObjectProperties {
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
