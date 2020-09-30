import { ContextVariableProvider } from "@mcma/core";

export function functionName(contextVariableProvider: ContextVariableProvider): string {
    return contextVariableProvider.getRequiredContextVariable("WEBSITE_SITE_NAME");
}
export function azureSubscriptionId(contextVariableProvider: ContextVariableProvider): string {
    return contextVariableProvider.getRequiredContextVariable("AzureSubscriptionId");
}
export function azureTenantId(contextVariableProvider: ContextVariableProvider): string {
    return contextVariableProvider.getRequiredContextVariable("AzureTenantId");
}
export function azureResourceGroupName(contextVariableProvider: ContextVariableProvider): string {
    return contextVariableProvider.getRequiredContextVariable("AzureResourceGroupName");
}

export function jobCheckerWorkflowName(contextVariableProvider: ContextVariableProvider): string {
    return contextVariableProvider.getRequiredContextVariable("JobCheckerWorkflowName");
}