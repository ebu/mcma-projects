output "workflow_definition" {
  value = {
    name                      = var.name
    input_parameters          = [
      {
        parameter_name : "mediaWorkflowId"
        parameter_type : "url"
      },
      {
        parameter_name : "title"
        parameter_type : "string"
      },
      {
        parameter_name : "description"
        parameter_type : "string"
      },
      {
        parameter_name : "inputFile"
        parameter_type : "S3Locator"
      }
    ]
    optional_input_parameters = []
    output_parameters         = []
    state_machine_arn         = local.state_machine_arn
    activity_arns             = [
      aws_sfn_activity.step_03_extract_technical_metadata.id,
      aws_sfn_activity.step_05_create_thumbnail.id,
      aws_sfn_activity.step_07_create_web_version.id,
    ]
  }
}
