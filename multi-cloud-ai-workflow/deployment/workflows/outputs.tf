output "ai_workflow_id" {
  value = aws_sfn_state_machine.ai-workflow.id
}

output "conform_workflow_id" {
  value = aws_sfn_state_machine.conform-workflow.id
}

output "workflow_service_notification_url" {
  value = local.workflow_activity_callback_handler_url
}
