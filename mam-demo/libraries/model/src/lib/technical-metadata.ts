import { McmaObject, McmaObjectProperties } from "@mcma/core";

export interface TechnicalMetadataProperties extends McmaObjectProperties {
    codec?: string;
}

export class TechnicalMetadata extends McmaObject implements TechnicalMetadataProperties {
    codec: string;

    constructor(type: string, properties: TechnicalMetadataProperties) {
        super(type, properties);

        this.codec = this.codec ?? null;
    }
}

export interface ImageTechnicalMetadataProperties extends TechnicalMetadataProperties {
    width?: number;
    height?: number;
    aspectRatio?: string;
}

export class ImageTechnicalMetadata extends TechnicalMetadata implements ImageTechnicalMetadataProperties {
    width: number;
    height: number;
    aspectRatio: string;

    constructor(properties: ImageTechnicalMetadataProperties);
    constructor(type: string, properties: ImageTechnicalMetadataProperties);
    constructor(typeOrProperties: string | ImageTechnicalMetadataProperties, properties?: ImageTechnicalMetadataProperties) {
        if (!properties && typeof typeOrProperties !== "string") {
            properties = typeOrProperties;
            typeOrProperties = "ImageTechnicalProperties";
        }
        super(typeOrProperties as string, properties);

        this.width = this.width ?? null;
        this.height = this.height ?? null;
        this.aspectRatio = this.aspectRatio ?? null;
    }
}

export enum VideoScanType {
    Unknown = "Unknown",
    InterlacedLowerFieldFirst = "InterlacedLowerFieldFirst",
    InterlacedUpperFieldFirst = "InterlacedUpperFieldFirst",
    ProgressiveFrame = "ProgressiveFrame",
    ProgressiveSegmentedFrame = "ProgressiveSegmentedFrame",
}

export enum BitRateMode {
    Unknown = "Unknown",
    ConstantBitRate = "ConstantBitRate",
    VariableBitRate = "VariableBitRate",
}

export interface VideoTechnicalMetadataProperties extends ImageTechnicalMetadataProperties {
    duration?: number;
    frameRate?: number;
    bitRate?: number;
    bitRateMode?: BitRateMode;
    scanType?: VideoScanType;
}

export class VideoTechnicalMetadata extends ImageTechnicalMetadata implements VideoTechnicalMetadataProperties {
    duration: number;
    frameRate: number;
    bitRate: number;
    bitRateMode: BitRateMode;
    scanType: VideoScanType;

    constructor(properties: VideoTechnicalMetadataProperties) {
        super("VideoTechnicalMetadataProperties", properties);

        this.duration = this.duration ?? null;
        this.frameRate = this.frameRate ?? null;
        this.bitRate = this.bitRate ?? null;
        this.bitRateMode = this.bitRateMode ?? BitRateMode.Unknown;
        this.scanType = this.scanType ?? VideoScanType.Unknown;
    }
}

export interface AudioTechnicalMetadataProperties extends TechnicalMetadataProperties {
    duration?: number;
    channels?: number;
    samplingRate?: number;
    sampleSize?: number;
    bitRate?: number;
}

export class AudioTechnicalMetadata extends TechnicalMetadata implements AudioTechnicalMetadataProperties {
    duration: number;
    channels: number;
    samplingRate: number;
    sampleSize: number;
    bitRate: number;

    constructor(properties: AudioTechnicalMetadataProperties) {
        super("AudioTechnicalMetadataProperties", properties);

        this.duration = this.duration ?? null;
        this.channels = this.channels ?? null;
        this.samplingRate = this.samplingRate ?? null;
        this.sampleSize = this.sampleSize ?? null;
        this.bitRate = this.bitRate ?? null;
    }
}
