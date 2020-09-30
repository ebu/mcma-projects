import { AuthProvider, ResourceManager } from "@mcma/client";
import { azureAdConfidentialClientAuth } from "@mcma/azure-client";

const tenantId = process.argv.find(x => x.startsWith("--azureTenantId=")).replace("--azureTenantId=", "");
const clientId = process.argv.find(x => x.startsWith("--azureClientId=")).replace("--azureClientId=", "");
const clientSecret = process.argv.find(x => x.startsWith("--azureClientSecret=")).replace("--azureClientSecret=", "");

export function createResourceManager(terraformOutput: any): ResourceManager {
    const servicesAuthContext = { scope: `${terraformOutput.service_registry_url.value}/.default` };
    const servicesUrl = terraformOutput.service_registry_url.value + "/services";

    const resourceManagerConfig = {
        servicesUrl,
        servicesAuthType: "AzureAD",
        servicesAuthContext
    };

    return new ResourceManager(
        resourceManagerConfig,
        new AuthProvider().add(azureAdConfidentialClientAuth({
            tenant: tenantId,
            auth: {
                clientId: clientId,
                clientSecret: clientSecret
            }
        })));
}