output app_storage_connection_string {
  value = azurerm_storage_account.app_storage_account.primary_connection_string
}

output app_storage_account_name {
  value = azurerm_storage_account.app_storage_account.name
}

output app_storage_sas {
  value = data.azurerm_storage_account_sas.app_storage_sas.sas
}

output app_storage_access_key {
  value = azurerm_storage_account.app_storage_account.primary_access_key
}

output deploy_container {
  value = azurerm_storage_container.deploy_container.name
}

output media_storage_connection_string {
  value = azurerm_storage_account.media_storage_account.primary_connection_string
}

output media_storage_account_name {
  value = azurerm_storage_account.media_storage_account.name
}

output media_storage_access_key {
  value = azurerm_storage_account.media_storage_account.primary_access_key
}