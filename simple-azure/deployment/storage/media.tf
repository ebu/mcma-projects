resource "azurerm_storage_account" "media_storage_account" {
  name                     = "${var.global_prefix_lower_only}media"
  resource_group_name      = var.resource_group_name
  location                 = var.azure_location
  account_kind             = "Storage"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "upload_container" {
  name                  = var.upload_container
  storage_account_name  = azurerm_storage_account.media_storage_account.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "output_container" {
  name                  = var.output_container
  storage_account_name  = azurerm_storage_account.media_storage_account.name
  container_access_type = "private"
}
