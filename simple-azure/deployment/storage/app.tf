resource "azurerm_storage_account" "app_storage_account" {
  name                     = "${var.global_prefix_lower_only}app"
  resource_group_name      = var.resource_group_name
  location                 = var.azure_location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

data "azurerm_storage_account_sas" "app_storage_sas" {
  connection_string = azurerm_storage_account.app_storage_account.primary_connection_string
  https_only        = true

  resource_types {
    service   = false
    container = false
    object    = true
  }

  services {
    blob  = true
    queue = false
    table = false
    file  = false
  }

  start  = "2020-09-08"
  expiry = "2021-09-08"

  permissions {
    read    = true
    write   = false
    delete  = false
    list    = false
    add     = false
    create  = false
    update  = false
    process = false
  }
}

resource "azurerm_storage_container" "deploy_container" {
  name                  = var.deploy_container
  storage_account_name  = azurerm_storage_account.app_storage_account.name
  container_access_type = "private"
}