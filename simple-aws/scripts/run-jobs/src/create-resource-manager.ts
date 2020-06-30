import * as AWS from "aws-sdk";
import { ResourceManager, ResourceManagerProvider, AuthProvider } from "@mcma/client";
import { awsV4Auth } from "@mcma/aws-client";

import { TerraformOutput } from "./terraform-output";

export function createResourceManager(): ResourceManager {
    const resourceManagerProvider =
        new ResourceManagerProvider(
            new AuthProvider().add(awsV4Auth(AWS)),
            {
                servicesUrl: TerraformOutput.service_registry_url.value + "/services",
                servicesAuthType: TerraformOutput.service_registry_auth_type.value
            });
    
    return resourceManagerProvider.get();
}