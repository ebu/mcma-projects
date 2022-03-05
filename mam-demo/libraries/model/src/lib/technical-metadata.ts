import { McmaObject, McmaObjectProperties } from "@mcma/core";

export interface TechnicalMetadataProperties extends McmaObjectProperties {
    codec?: string;
}

export class TechnicalMetadata extends McmaObject implements TechnicalMetadataProperties {
    codec?: string;

    constructor(type: string, properties: TechnicalMetadataProperties) {
        super(type, properties);

        this.checkProperty("codec", "string", false);
    }
}

export interface ImageTechnicalMetadataProperties extends TechnicalMetadataProperties {
    width?: number;
    height?: number;
    aspectRatio?: string;
}

export class ImageTechnicalMetadata extends TechnicalMetadata implements ImageTechnicalMetadataProperties {
    width?: number;
    height?: number;
    aspectRatio?: string;

    constructor(properties: ImageTechnicalMetadataProperties);
    constructor(type: string, properties: ImageTechnicalMetadataProperties);
    constructor(typeOrProperties: string | ImageTechnicalMetadataProperties, properties?: ImageTechnicalMetadataProperties) {
        if (!properties && typeof typeOrProperties !== "string") {
            properties = typeOrProperties;
            typeOrProperties = "ImageTechnicalMetadata";
        }
        super(typeOrProperties as string, properties);

        this.checkProperty("width", "number", false);
        this.checkProperty("height", "number", false);
        this.checkProperty("aspectRatio", "string", false);
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
    frameRate?: number;
    bitRate?: number;
    bitRateMode?: BitRateMode;
    scanType?: VideoScanType;
}

export class VideoTechnicalMetadata extends ImageTechnicalMetadata implements VideoTechnicalMetadataProperties {
    frameRate?: number;
    bitRate?: number;
    bitRateMode: BitRateMode;
    scanType: VideoScanType;

    constructor(properties: VideoTechnicalMetadataProperties) {
        super("VideoTechnicalMetadata", properties);

        this.checkProperty("frameRate", "number", false);
        this.checkProperty("bitRate", "number", false);

        this.bitRateMode = this.bitRateMode ?? BitRateMode.Unknown;
        this.scanType = this.scanType ?? VideoScanType.Unknown;
    }
}

export interface AudioTechnicalMetadataProperties extends TechnicalMetadataProperties {
    channels?: number;
    samplingRate?: number;
    sampleSize?: number;
    bitRate?: number;
    bitRateMode?: BitRateMode;
}

export class AudioTechnicalMetadata extends TechnicalMetadata implements AudioTechnicalMetadataProperties {
    channels?: number;
    samplingRate?: number;
    sampleSize?: number;
    bitRate?: number;
    bitRateMode?: BitRateMode;

    constructor(properties: AudioTechnicalMetadataProperties) {
        super("AudioTechnicalMetadata", properties);

        this.checkProperty("channels", "number", false);
        this.checkProperty("samplingRate", "number", false);
        this.checkProperty("sampleSize", "number", false);
        this.checkProperty("bitRate", "number", false);

        this.bitRateMode = this.bitRateMode ?? BitRateMode.Unknown;
    }
}
