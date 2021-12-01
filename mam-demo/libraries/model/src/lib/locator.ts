// copied from MCMA Libraries 0.14.x. To be removed when we upgrade

import { McmaObject, McmaObjectProperties } from "@mcma/core";

export interface LocatorProperties extends McmaObjectProperties {
    url: string
}

export abstract class Locator extends McmaObject implements LocatorProperties {
    url: string;

    protected constructor(type: string, properties?: LocatorProperties) {
        super(type, properties);

        this.checkProperty("url", "string", true);
    }
}
