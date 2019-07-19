import { S3Object } from "./s3-object";

export interface S3Bucket {
    name: string;
    objects: S3Object[];
}