output "ai_workflow_id" {
  value = aws_sfn_state_machine.ai_workflow.id
}

output "conform_workflow_id" {
  value = aws_sfn_state_machine.conform_workflow.id
}

output "workflow_service_notification_url" {
  value = local.workflow_activity_callback_handler_url
}
