// copied from MCMA Libraries 0.14.x. To be removed when we upgrade

import { McmaException } from "@mcma/core";
import { Locator, LocatorProperties } from "./locator";

export interface S3LocatorProperties extends LocatorProperties {
    region?: string;
    bucket?: string;
    key?: string;
}

export class S3Locator extends Locator implements S3LocatorProperties {
    public region: string;
    public bucket: string;
    public key: string;

    constructor(properties: S3LocatorProperties) {
        super("S3Locator", properties);

        const url = new URL(this.url);

        // checking domain name
        const parts = url.hostname.split(".");
        if (parts.length < 3 ||
            parts[parts.length - 1] !== "com" ||
            parts[parts.length - 2] !== "amazonaws") {

            // in case it's not a S3 bucket hosted on AWS we assume path style and no region
            const pos = url.pathname.indexOf("/", 1);
            if (pos < 0) {
                throw new McmaException("Invalid S3 url. Failed to determine bucket");
            }
            this.region = "";
            this.bucket = url.pathname.substring(1, pos);
            this.key = url.pathname.substring(pos + 1);
            return;
        }

        // determining region
        let oldStyle = false;

        if (parts[parts.length - 3].startsWith("s3-")) {
            this.region = parts[parts.length - 3].substring(3);
            oldStyle = true;
        } else if (parts[parts.length - 3] === "s3") {
            this.region = "us-east-1";
            oldStyle = true;
        } else if (parts[parts.length - 4] === "s3") {
            this.region = parts[parts.length - 3];
        } else {
            throw new McmaException("Invalid S3 url. Failed to determine region");
        }

        // determining bucket and key
        const pathStyle = parts.length === (oldStyle ? 3 : 4);
        if (pathStyle) {
            const pos = url.pathname.indexOf("/", 1);
            if (pos < 0) {
                throw new McmaException("Invalid S3 url. Failed to determine bucket");
            }
            this.bucket = url.pathname.substring(1, pos);
            this.key = url.pathname.substring(pos + 1);
        } else {
            this.bucket = parts.slice(0, parts.length - (oldStyle ? 3 : 4)).join(".");
            this.key = url.pathname.substring(1);
        }
    }
}
