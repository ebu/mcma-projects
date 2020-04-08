import { LocatorProperties } from "@mcma/core";

import { BMEssenceProperties, BMEssence } from "./bm-essence";
import { AwsS3FileLocatorProperties, AwsS3FolderLocatorProperties, isAwsS3FileLocator, isAwsS3FolderLocator } from "@mcma/aws-s3";

export function getLocationsOfType<T extends LocatorProperties>(essence: BMEssenceProperties, typeFilter: (x: LocatorProperties) => x is T): T[] {
    return essence?.locations?.map(l => typeFilter(l) ? l : null).filter(l => !!l);
}

export function getAwsS3FileLocations(essence: BMEssence): AwsS3FileLocatorProperties[] {
    return getLocationsOfType<AwsS3FileLocatorProperties>(essence, isAwsS3FileLocator);
}

export function getAwsS3FolderLocations(essence: BMEssence): AwsS3FolderLocatorProperties[] {
    return getLocationsOfType<AwsS3FolderLocatorProperties>(essence, isAwsS3FolderLocator);
}