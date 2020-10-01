import { ContextVariableProvider } from "@mcma/core";
import { LogicManagementClient } from "@azure/arm-logic";
import { loginWithAppServiceMSI } from "@azure/ms-rest-nodeauth";
import { azureResourceGroupName, azureSubscriptionId, jobCheckerWorkflowName } from "./context-variable-helpers";

export class PeriodicJobCheckerCronJob {
    private logicManagementClient: LogicManagementClient;

    constructor(private readonly contextVariableProvider: ContextVariableProvider) { }

    private async getClient() {
        if (!this.logicManagementClient) {
            const credentials = await loginWithAppServiceMSI();
            // @ts-ignore
            this.logicManagementClient = new LogicManagementClient(credentials, azureSubscriptionId(this.contextVariableProvider));
        }
        return this.logicManagementClient;
    }

    async enable() {
        const client = await this.getClient();
        await client.workflows.enable(azureResourceGroupName(this.contextVariableProvider), jobCheckerWorkflowName(this.contextVariableProvider));
    }

    async disable() {
        const client = await this.getClient();
        await client.workflows.disable(azureResourceGroupName(this.contextVariableProvider), jobCheckerWorkflowName(this.contextVariableProvider));
    }
}