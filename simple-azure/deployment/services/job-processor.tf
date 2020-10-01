locals {
  job_processor_worker_zip_file = "./../services/job-processor/worker/build/dist/function.zip"

  job_processor_api_zip_file      = "./../services/job-processor/api-handler/build/dist/function.zip"
  job_processor_api_function_name = "${var.global_prefix}-job-processor-api"
  job_processor_api_url           = "https://${local.job_processor_api_function_name}.azurewebsites.net"

  job_processor_job_checker_zip_file      = "./../services/job-processor/periodic-job-checker/build/dist/function.zip"
  job_processor_job_checker_function_name = "${var.global_prefix}-job-processor-periodic-job-checker"
  job_processor_job_checker_url           = "https://${local.job_processor_job_checker_function_name}.azurewebsites.net"
  job_processor_job_checker_workflow_name = "CheckForStalledJobs"

  job_processor_job_cleanup_zip_file      = "./../services/job-processor/periodic-job-cleanup/build/dist/function.zip"
  job_processor_job_cleanup_function_name = "${var.global_prefix}-job-processor-periodic-job-cleanup"
  job_processor_job_cleanup_url           = "https://${local.job_processor_job_cleanup_function_name}.azurewebsites.net"
}

resource "azurerm_cosmosdb_sql_container" "job_processor_cosmosdb_container" {
  name                = "JobProcessor"
  resource_group_name = var.resource_group_name
  account_name        = var.cosmosdb_account_name
  database_name       = var.cosmosdb_db_name
  partition_key_path  = "/partitionKey"
}

#===================================================================
# Worker Function
#===================================================================

resource "azurerm_storage_queue" "job_processor_worker_function_queue" {
  name                 = "job-processor-work-queue"
  storage_account_name = var.app_storage_account_name
}

resource "azurerm_storage_blob" "job_processor_worker_function_zip" {
  name                   = "job-processor/worker/function_${filesha256(local.job_processor_worker_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.job_processor_worker_zip_file
}

resource "azurerm_function_app" "job_processor_worker_function" {
  name                       = "${var.global_prefix}-job-processor-worker"
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.job_processor_worker_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.job_processor_worker_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    WorkQueueStorage       = var.app_storage_connection_string
    TableName              = azurerm_cosmosdb_sql_container.job_processor_cosmosdb_container.name
    PublicUrl              = local.job_processor_api_url
    AzureSubscriptionId    = var.azure_subscription_id
    AzureTenantId          = var.azure_tenant_id
    AzureResourceGroupName = var.resource_group_name
    CosmosDbEndpoint       = var.cosmosdb_endpoint
    CosmosDbKey            = var.cosmosdb_key
    CosmosDbDatabaseId     = local.cosmosdb_id
    CosmosDbRegion         = var.azure_location
    ServicesUrl            = local.services_url
    ServicesAuthType       = "AzureAD"
    ServicesAuthContext    = "{ \"scope\": \"${local.service_registry_url}/.default\" }"
    JobCheckerWorkflowName = local.job_processor_job_checker_workflow_name
  }

  provisioner "local-exec" {
    command = "az webapp start --resource-group ${var.resource_group_name} --name ${azurerm_function_app.job_processor_worker_function.name}"
  }
}

#===================================================================
# API Function
#===================================================================

resource "azuread_application" "job_processor_api_app" {
  name            = local.job_processor_api_function_name
  identifier_uris = [local.job_processor_api_url]
}

resource "azuread_service_principal" "job_processor_api_sp" {
  application_id               = azuread_application.job_processor_api_app.application_id
  app_role_assignment_required = false
}

resource "azurerm_storage_blob" "job_processor_api_function_zip" {
  name                   = "job-processor/api/function_${filesha256(local.job_processor_api_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.job_processor_api_zip_file
}

resource "azurerm_function_app" "job_processor_api_function" {
  name                       = local.job_processor_api_function_name
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  auth_settings {
    enabled                       = true
    issuer                        = "https://sts.windows.net/${var.azure_tenant_id}"
    default_provider              = "AzureActiveDirectory"
    unauthenticated_client_action = "RedirectToLoginPage"
    active_directory {
      client_id         = azuread_application.job_processor_api_app.application_id
      allowed_audiences = [local.job_processor_api_url]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.job_processor_api_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.job_processor_api_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    TableName           = azurerm_cosmosdb_sql_container.job_processor_cosmosdb_container.name
    PublicUrl           = local.job_processor_api_url
    CosmosDbEndpoint    = var.cosmosdb_endpoint
    CosmosDbKey         = var.cosmosdb_key
    CosmosDbDatabaseId  = local.cosmosdb_id
    CosmosDbRegion      = var.azure_location
    ServicesUrl         = local.services_url
    ServicesAuthType    = "AzureAD"
    ServicesAuthContext = "{ \"scope\": \"${local.service_registry_url}/.default\" }"
    WorkerFunctionId    = azurerm_storage_queue.job_processor_worker_function_queue.name
  }
}

#===================================================================
# Job Checker Function
#===================================================================

resource "azuread_application" "job_processor_job_checker_app" {
  name            = local.job_processor_job_checker_function_name
  identifier_uris = [local.job_processor_job_checker_url]
}

resource "azuread_service_principal" "job_processor_job_checker_sp" {
  application_id               = azuread_application.job_processor_job_checker_app.application_id
  app_role_assignment_required = false
}

resource "azurerm_storage_blob" "job_processor_job_checker_function_zip" {
  name                   = "job-processor/job-checker/function_${filesha256(local.job_processor_job_checker_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.job_processor_job_checker_zip_file
}

resource "azurerm_function_app" "job_processor_job_checker_function" {
  name                       = local.job_processor_job_checker_function_name
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  identity {
    type = "SystemAssigned"
  }

  auth_settings {
    enabled                       = true
    issuer                        = "https://sts.windows.net/${var.azure_tenant_id}"
    default_provider              = "AzureActiveDirectory"
    unauthenticated_client_action = "RedirectToLoginPage"
    active_directory {
      client_id         = azuread_application.job_processor_job_checker_app.application_id
      allowed_audiences = [local.job_processor_job_checker_url]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.job_processor_job_checker_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.job_processor_job_checker_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    TableName              = azurerm_cosmosdb_sql_container.job_processor_cosmosdb_container.name
    PublicUrl              = local.job_processor_api_url
    AzureSubscriptionId    = var.azure_subscription_id
    AzureTenantId          = var.azure_tenant_id
    AzureResourceGroupName = var.resource_group_name
    CosmosDbEndpoint       = var.cosmosdb_endpoint
    CosmosDbKey            = var.cosmosdb_key
    CosmosDbDatabaseId     = local.cosmosdb_id
    CosmosDbRegion         = var.azure_location
    WorkerFunctionId       = azurerm_storage_queue.job_processor_worker_function_queue.name
    JobCheckerWorkflowName = local.job_processor_job_checker_workflow_name
  }
}

resource "azurerm_template_deployment" "job_processor_job_checker_workflow" {
  name                = local.job_processor_job_checker_workflow_name
  resource_group_name = var.resource_group_name
  deployment_mode     = "Incremental"

  parameters = {
    workflowName        = local.job_processor_job_checker_workflow_name
    functionUrl         = local.job_processor_job_checker_url
    recurrenceFrequency = "Minute"
    recurrenceInterval  = 2
    state               = "Disabled"
  }

  template_body = <<DEPLOY
{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "workflowName": { "type": "string" },
        "functionUrl": { "type": "string" },
        "recurrenceFrequency": { "type": "string" },
        "recurrenceInterval": { "type": "string" },
        "state": { "type": "string" }
    },
    "variables": {},
    "resources": [
        {
            "type": "Microsoft.Logic/workflows",
            "apiVersion": "2017-07-01",
            "name": "[parameters('workflowName')]",
            "location": "[resourceGroup().location]",
            "identity": {
               "type": "SystemAssigned"
            },
            "properties": {
                "state": "[parameters('state')]",
                "definition": {
                    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {},
                    "triggers": {
                        "Recurrence": {
                            "recurrence": {
                                "frequency": "[parameters('recurrenceFrequency')]",
                                "interval": "[parameters('recurrenceInterval')]"
                            },
                            "type": "Recurrence"
                        }
                    },
                    "actions": {
                        "HTTP": {
                            "runAfter": {},
                            "type": "Http",
                            "inputs": {
                                "authentication": {
                                    "type": "ManagedServiceIdentity",
                                    "audience": "[parameters('functionUrl')]"
                                },
                                "method": "POST",
                                "uri": "[parameters('functionUrl')]"
                            }
                        }
                    },
                    "outputs": {}
                },
                "parameters": {}
            }
        }
    ]
}
DEPLOY
}


#===================================================================
# Job Cleanup Function
#===================================================================

resource "azuread_application" "job_processor_job_cleanup_app" {
  name            = local.job_processor_job_cleanup_function_name
  identifier_uris = [local.job_processor_job_cleanup_url]
}

resource "azuread_service_principal" "job_processor_job_cleanup_sp" {
  application_id               = azuread_application.job_processor_job_cleanup_app.application_id
  app_role_assignment_required = false
}

resource "azurerm_storage_blob" "job_processor_job_cleanup_function_zip" {
  name                   = "job-processor/job-cleanup/function_${filesha256(local.job_processor_job_cleanup_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.job_processor_job_cleanup_zip_file
}

resource "azurerm_function_app" "job_processor_job_cleanup_function" {
  name                       = local.job_processor_job_cleanup_function_name
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  auth_settings {
    enabled                       = true
    issuer                        = "https://sts.windows.net/${var.azure_tenant_id}"
    default_provider              = "AzureActiveDirectory"
    unauthenticated_client_action = "RedirectToLoginPage"
    active_directory {
      client_id         = azuread_application.job_processor_job_cleanup_app.application_id
      allowed_audiences = [local.job_processor_job_cleanup_url]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.job_processor_job_cleanup_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.job_processor_job_cleanup_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    TableName              = azurerm_cosmosdb_sql_container.job_processor_cosmosdb_container.name
    PublicUrl              = local.job_processor_api_url
    AzureSubscriptionId    = var.azure_subscription_id
    AzureTenantId          = var.azure_tenant_id
    AzureResourceGroupName = var.resource_group_name
    CosmosDbEndpoint       = var.cosmosdb_endpoint
    CosmosDbKey            = var.cosmosdb_key
    CosmosDbDatabaseId     = local.cosmosdb_id
    CosmosDbRegion         = var.azure_location
    WorkerFunctionId       = azurerm_storage_queue.job_processor_worker_function_queue.name
  }
}


resource "azurerm_template_deployment" "job_processor_job_cleanup_workflow" {
  name                = "CleanupOldJobs"
  resource_group_name = var.resource_group_name
  deployment_mode     = "Incremental"

  parameters = {
    workflowName        = "CleanupOldJobs"
    functionUrl         = local.job_processor_job_cleanup_url
    recurrenceFrequency = "Day"
    recurrenceInterval  = 2
    state               = "Enabled"
  }

  template_body = <<DEPLOY
{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "workflowName": { "type": "string" },
        "functionUrl": { "type": "string" },
        "recurrenceFrequency": { "type": "string" },
        "recurrenceInterval": { "type": "string" },
        "state": { "type": "string" }
    },
    "variables": {},
    "resources": [
        {
            "type": "Microsoft.Logic/workflows",
            "apiVersion": "2017-07-01",
            "name": "[parameters('workflowName')]",
            "location": "[resourceGroup().location]",
            "identity": {
               "type": "SystemAssigned"
            },
            "properties": {
                "state": "[parameters('state')]",
                "definition": {
                    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {},
                    "triggers": {
                        "Recurrence": {
                            "recurrence": {
                                "frequency": "[parameters('recurrenceFrequency')]",
                                "interval": "[parameters('recurrenceInterval')]"
                            },
                            "type": "Recurrence"
                        }
                    },
                    "actions": {
                        "HTTP": {
                            "runAfter": {},
                            "type": "Http",
                            "inputs": {
                                "authentication": {
                                    "type": "ManagedServiceIdentity",
                                    "audience": "[parameters('functionUrl')]"
                                },
                                "method": "POST",
                                "uri": "[parameters('functionUrl')]"
                            }
                        }
                    },
                    "outputs": {}
                },
                "parameters": {}
            }
        }
    ]
}
DEPLOY
}

data "azurerm_subscription" "primary" {}

resource "azurerm_role_definition" "job_checker_workflow_toggler_role" {
  name  = "${var.global_prefix}-job-checker-workflow-toggler"
  scope = data.azurerm_subscription.primary.id

  permissions {
    actions = [
      "Microsoft.Logic/workflows/enable/action",
      "Microsoft.Logic/workflows/disable/action",
    ]
    not_actions = []
  }

  assignable_scopes = [data.azurerm_subscription.primary.id]
}

resource "azurerm_role_assignment" "job_processor_worker_role_assignment" {
  scope              = data.azurerm_subscription.primary.id
  role_definition_id = azurerm_role_definition.job_checker_workflow_toggler_role.id
  principal_id       = azurerm_function_app.job_processor_worker_function.identity[0].principal_id
}

resource "azurerm_role_assignment" "job_processor_job_checker_role_assignment" {
  scope              = data.azurerm_subscription.primary.id
  role_definition_id = azurerm_role_definition.job_checker_workflow_toggler_role.id
  principal_id       = azurerm_function_app.job_processor_job_checker_function.identity[0].principal_id
}