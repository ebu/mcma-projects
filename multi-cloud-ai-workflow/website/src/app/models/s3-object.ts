
export interface S3Object {
    key: string;
    etag: string;
    lastModified: Date;
    size: number;
    owner: string;
}