import { Locator, LocatorProperties, McmaResource, McmaResourceProperties } from "@mcma/core";
import { S3Locator, S3LocatorProperties } from "@mcma/aws-s3";

import {
    AudioTechnicalMetadata,
    AudioTechnicalMetadataProperties,
    ImageTechnicalMetadata,
    ImageTechnicalMetadataProperties,
    VideoTechnicalMetadata,
    VideoTechnicalMetadataProperties
} from "./technical-metadata";

export interface MediaEssenceProperties extends McmaResourceProperties {
    filename?: string;
    extension?: string;
    size?: number;
    locators?: LocatorProperties[];
}

export class MediaEssence extends McmaResource implements MediaEssenceProperties {
    filename?: string;
    extension?: string;
    size: number;
    locators: Locator[];

    constructor(properties: MediaEssenceProperties);
    constructor(type: string, properties: MediaEssenceProperties);
    constructor(typeOrProperties: string | MediaEssenceProperties, properties?: MediaEssenceProperties) {
        if (!properties && typeof typeOrProperties !== "string") {
            properties = typeOrProperties;
            typeOrProperties = "MediaEssence";
        }
        super(<string>typeOrProperties, properties);

        if (!Array.isArray(this.locators)) {
            this.locators = [];
        }

        this.locators = this.locators.map(locator => {
            if (locator["@type"] === "S3Locator") {
                return new S3Locator(locator as S3LocatorProperties);
            } else {
                return locator;
            }
        });

        if (!this.size) {
            this.size = 0;
        }
    }
}

export interface ImageEssenceProperties extends MediaEssenceProperties {
    imageTechnicalMetadata?: ImageTechnicalMetadataProperties;
}

export class ImageEssence extends MediaEssence implements ImageEssenceProperties {
    imageTechnicalMetadata: ImageTechnicalMetadata;

    constructor(properties: ImageEssenceProperties) {
        super("ImageEssence", properties);

        if (properties.imageTechnicalMetadata) {
            this.imageTechnicalMetadata = new ImageTechnicalMetadata(properties.imageTechnicalMetadata);
        }
    }
}

export interface VideoEssenceProperties extends MediaEssenceProperties {
    audioTechnicalMetadata?: AudioTechnicalMetadataProperties;
    videoTechnicalMetadata?: VideoTechnicalMetadataProperties;
}

export class VideoEssence extends MediaEssence implements VideoEssenceProperties {
    audioTechnicalMetadata: AudioTechnicalMetadata;
    videoTechnicalMetadata: VideoTechnicalMetadata;

    constructor(properties: VideoEssenceProperties) {
        super("VideoEssence", properties);

        if (properties.audioTechnicalMetadata) {
            this.audioTechnicalMetadata = new AudioTechnicalMetadata(properties.audioTechnicalMetadata);
        }
        if (properties.videoTechnicalMetadata) {
            this.videoTechnicalMetadata = new VideoTechnicalMetadata(properties.videoTechnicalMetadata);
        }
    }
}

export interface AudioEssenceProperties extends MediaEssenceProperties {
    audioTechnicalMetadata?: AudioTechnicalMetadataProperties;
}

export class AudioEssence extends MediaEssence implements AudioEssenceProperties {
    audioTechnicalMetadata: AudioTechnicalMetadata;

    constructor(properties: AudioEssenceProperties) {
        super("AudioEssence", properties);

        if (this.audioTechnicalMetadata) {
            this.audioTechnicalMetadata = new AudioTechnicalMetadata(this.audioTechnicalMetadata);
        }
    }
}
