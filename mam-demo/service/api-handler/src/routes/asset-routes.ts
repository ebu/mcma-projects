import { S3 } from "aws-sdk";

import { DefaultRouteCollection } from "@mcma/api";
import { DynamoDbTableProvider } from "@mcma/aws-dynamodb";

import { MediaAsset } from "@local/model";
import { S3Locator } from "@mcma/aws-s3";

function signUrl(url: string, s3: S3): string {
    const locator = new S3Locator({ url });
    return s3.getSignedUrl("getObject", {
        Bucket: locator.bucket,
        Key: locator.key,
        Expires: 12 * 3600
    });
}

function signMediaAssetUrls(mediaAsset: MediaAsset, s3: S3) {
    if (mediaAsset.thumbnailUrl) {
        mediaAsset.thumbnailUrl = signUrl(mediaAsset.thumbnailUrl, s3);
    }
    if (mediaAsset.videoUrl) {
        mediaAsset.videoUrl = signUrl(mediaAsset.thumbnailUrl, s3);
    }
}

export function buildAssetRoutes(dbTableProvider: DynamoDbTableProvider, s3: S3) {
    const routes = new DefaultRouteCollection(dbTableProvider, MediaAsset, "/assets");

    routes.remove("create");
    routes.remove("update");

    routes.get.onCompleted = async (requestContext, mediaAsset) => {
        signMediaAssetUrls(mediaAsset, s3);
    };
    routes.query.onCompleted = async (requestContext, queryResults) => {
        for (const mediaAsset of queryResults.results) {
            signMediaAssetUrls(mediaAsset, s3);
        }
    };

    return routes;
}

