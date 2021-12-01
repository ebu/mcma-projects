import { McmaResource, McmaResourceProperties } from "@mcma/core";

export interface MediaAssetProperties extends McmaResourceProperties {
    title: string;
    description: string;
    thumbnailUrl?: string;
    videoUrl?: string;
}

export class MediaAsset extends McmaResource implements MediaAssetProperties {
    title: string;
    description: string;
    thumbnailUrl?: string;
    videoUrl?: string;

    constructor(properties: MediaAssetProperties) {
        super("MediaAsset", properties);

        this.checkProperty("title", "string", true);
        this.checkProperty("description", "string", true);
        this.checkProperty("thumbnailUrl", "string", false);
        this.checkProperty("videoUrl", "string", false);
    }
}
