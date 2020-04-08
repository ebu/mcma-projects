import { McmaResource, McmaResourceProperties } from "@mcma/core";

import { DescriptiveMetadata } from "./descriptive-metadata";

export interface BMContentProperties extends McmaResourceProperties {
    metadata?: DescriptiveMetadata;
    essences?: string[];

    awsAiMetadata?: any;
    azureAiMetadata?: any;
    googleAiMetadata?: any;

    awsSrt?: { transcription?: { original?: string } };
    awsSrtClean?: { transcription?: { original?: string } };
}

export class BMContent extends McmaResource implements BMContentProperties {
    metadata?: DescriptiveMetadata;
    essences?: string[];

    awsAiMetadata?: any;
    azureAiMetadata?: any;
    googleAiMetadata?: any;

    awsSrt?: { transcription?: { original?: string } };
    awsSrtClean?: { transcription?: { original?: string } };
    
    constructor(properties: BMContentProperties) {
        super("BMContent", properties);
    }
}

