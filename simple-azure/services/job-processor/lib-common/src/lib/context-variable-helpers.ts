import { EnvironmentVariables } from "@mcma/core";

export function functionName(environmentVariables: EnvironmentVariables): string {
    return environmentVariables.get("WEBSITE_SITE_NAME");
}
export function azureSubscriptionId(environmentVariables: EnvironmentVariables): string {
    return environmentVariables.get("AzureSubscriptionId");
}
export function azureTenantId(environmentVariables: EnvironmentVariables): string {
    return environmentVariables.get("AzureTenantId");
}
export function azureResourceGroupName(environmentVariables: EnvironmentVariables): string {
    return environmentVariables.get("AzureResourceGroupName");
}

export function jobCheckerWorkflowName(environmentVariables: EnvironmentVariables): string {
    return environmentVariables.get("JobCheckerWorkflowName");
}