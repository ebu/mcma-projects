import { ResourceManager, ResourceManagerProvider, AuthProvider } from "@mcma/client";
import { googleAuth } from "@mcma/google-cloud-client";

import { TerraformOutput } from "./terraform-output";

export function createResourceManager(keyFile: string): ResourceManager {
    const resourceManagerProvider =
        new ResourceManagerProvider(
            new AuthProvider().add(googleAuth({ keyFile })),
            {
                servicesUrl: TerraformOutput.service_registry_url.value + "/services",
                servicesAuthType: "Google",
                servicesAuthContext: { scopes: TerraformOutput.service_registry_url.value }
            });
    
    return resourceManagerProvider.get();
}