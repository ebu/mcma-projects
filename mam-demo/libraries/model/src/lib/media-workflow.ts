import { McmaResource, McmaResourceProperties } from "@mcma/core";

export enum MediaWorkflowType {
    MediaIngest = "MediaIngest",
    SpeechToTextAws = "SpeechToTextAws",
}

export interface MediaWorkflowProperties extends McmaResourceProperties {
    type: MediaWorkflowType;
    input: { [key: string]: any };
    mediaAssetId?: string;
    mediaAssetWorkflowId?: string;
}

export class MediaWorkflow extends McmaResource implements MediaWorkflowProperties {
    type: MediaWorkflowType;
    input: { [key: string]: any };
    mediaAssetId?: string;
    mediaAssetWorkflowId?: string;

    constructor(properties: MediaWorkflowProperties) {
        super("MediaWorkflow", properties);

        this.checkProperty("type", "string", true);
        this.checkProperty("input", "object", true);
        this.checkProperty("mediaAssetId", "url", false);
        this.checkProperty("mediaAssetWorkflowId", "url", false);
    }
}

export interface MediaAssetWorkflowProperties extends McmaResourceProperties {
    mediaWorkflowType: MediaWorkflowType;
    mediaWorkflowId: string;
    data: { [key: string]: any };
}

export class MediaAssetWorkflow extends McmaResource implements MediaAssetWorkflowProperties {
    mediaWorkflowType: MediaWorkflowType;
    mediaWorkflowId: string;
    data: { [key: string]: any };

    constructor(properties: MediaAssetWorkflowProperties) {
        super("MediaAssetWorkflow", properties);

        this.checkProperty("mediaWorkflowType", "string", true);
        this.checkProperty("mediaWorkflowId", "url", true);
        this.checkProperty("data", "object", true);
    }
}
