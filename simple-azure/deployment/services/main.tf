locals {
  cosmosdb_id          = "${var.global_prefix}-db"
  deploy_container_url = "https://${var.app_storage_account_name}.blob.core.windows.net/${var.deploy_container}"
}

resource "azurerm_app_service_plan" "mcma_services" {
  name                = "${var.global_prefix}-services-appsvcplan"
  location            = var.azure_location
  resource_group_name = var.resource_group_name
  kind                = "FunctionApp"

  sku {
    tier = "Dynamic"
    size = "Y1"
  }
}

resource "azurerm_application_insights" "services_appinsights" {
  name                = "${var.global_prefix}-services-appinsights"
  resource_group_name = var.resource_group_name
  location            = var.azure_location
  application_type    = "web"
}
