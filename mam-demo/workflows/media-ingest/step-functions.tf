#################################
#  Step Functions Workflow definition
#################################

resource "aws_iam_role" "workflow" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-step-functions")
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Principal = {
          Service = "states.${var.aws_region}.amazonaws.com"
        }
        Effect    = "Allow"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "workflow" {
  name   = aws_iam_role.workflow.name
  role   = aws_iam_role.workflow.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.step_01_validate_input.arn,
          aws_lambda_function.step_02_create_media_asset.arn,
          aws_lambda_function.step_03_extract_technical_metadata.arn,
          aws_lambda_function.step_04_register_original_media.arn,
          aws_lambda_function.step_05_create_thumbnail.arn,
          aws_lambda_function.step_06_register_thumbnail.arn,
          aws_lambda_function.step_07_create_web_version.arn,
          aws_lambda_function.step_08_register_web_version.arn,
        ]
      }
    ]
  })
}

#################################
#  Step Functions : Workflow
#################################

resource "aws_sfn_state_machine" "workflow" {
  name       = var.prefix
  role_arn   = aws_iam_role.workflow.arn
  definition = jsonencode({
    Comment = "Media Ingest"
    StartAt = "Validate input"
    States  = {
      "Validate input"             = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_01_validate_input.arn
        ResultPath = null
        Next       = "Create media asset"
      }
      "Create media asset"         = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_02_create_media_asset.arn
        ResultPath = "$.data"
        Next       = "Extract technical metadata"
      }
      "Extract technical metadata" = {
        Type       = "Parallel"
        Branches   = [
          {
            StartAt = "Start AME job"
            States  = {
              "Start AME job" = {
                Type     = "Task"
                Resource = aws_lambda_function.step_03_extract_technical_metadata.arn
                End      = true
              }
            }
          },
          {
            StartAt = "Wait for AME job completion"
            States  = {
              "Wait for AME job completion" = {
                Type           = "Task"
                Resource       = aws_sfn_activity.step_03_extract_technical_metadata.id
                ResultPath     = "$.data.technicalMetadataJobId"
                TimeoutSeconds = 3600
                End            = true
              }
            }
          }
        ]
        OutputPath = "$[1]"
        Next       = "Register original media"
      }
      "Register original media"    = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_04_register_original_media.arn
        ResultPath = "$.data.createWebVersion"
        Next       = "Create thumbnail"
      }
      "Create thumbnail"           = {
        Type       = "Parallel"
        Branches   = [
          {
            StartAt = "Start create thumbnail job"
            States  = {
              "Start create thumbnail job" = {
                Type     = "Task"
                Resource = aws_lambda_function.step_05_create_thumbnail.arn
                End      = true
              }
            }
          },
          {
            StartAt = "Wait for thumbnail job completion"
            States  = {
              "Wait for thumbnail job completion" = {
                Type           = "Task"
                Resource       = aws_sfn_activity.step_05_create_thumbnail.id
                ResultPath     = "$.data.createThumbnailJobId"
                TimeoutSeconds = 3600
                End            = true
              }
            }
          }
        ]
        OutputPath = "$[1]"
        Next       = "Register thumbnail"
      }
      "Register thumbnail"         = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_06_register_thumbnail.arn
        ResultPath = null
        Next       = "Create web version of media?"
      }
      "Create web version of media?"           = {
        Type    = "Choice",
        Choices = [
          {
            Variable      = "$.data.createWebVersion"
            BooleanEquals = true
            Next          = "Transcode media"
          },
        ]
        Default = "Success"
      }
      "Transcode media"            = {
        Type       = "Parallel"
        Branches   = [
          {
            StartAt = "Start create web version job"
            States  = {
              "Start create web version job" = {
                Type     = "Task"
                Resource = aws_lambda_function.step_07_create_web_version.arn
                End      = true
              }
            }
          },
          {
            StartAt = "Wait for create web version job completion"
            States  = {
              "Wait for create web version job completion" = {
                Type           = "Task"
                Resource       = aws_sfn_activity.step_07_create_web_version.id
                ResultPath     = "$.data.mediaTranscodeJob"
                TimeoutSeconds = 3600
                End            = true
              }
            }
          }
        ]
        OutputPath = "$[1]"
        Next       = "Register web version of media"
      }
      "Register web version of media"  = {
        Type       = "Task"
        Resource   = aws_lambda_function.step_08_register_web_version.arn
        ResultPath = null
        Next       = "Success"
      }
      "Success"                    = {
        Type = "Succeed"
      }
    }
  })

  tags = var.tags
}

locals {
  ## local variable to avoid cyclic dependency
  state_machine_arn = "arn:aws:states:${var.aws_region}:${var.aws_account_id}:stateMachine:${var.prefix}"
}
