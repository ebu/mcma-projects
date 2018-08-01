# #################################
# #  Step Functions : Lambdas for ai Workflow
# #################################

# resource "aws_lambda_function" "ai-01-validate-workflow-input" {
#   filename         = "./../workflows/ai/01-validate-workflow-input/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-01-validate-workflow-input")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/01-validate-workflow-input/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-02-extract-speech-to-text" {
#   filename         = "./../workflows/ai/02-extract-speech-to-text/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-02-extract-speech-to-text")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/02-extract-speech-to-text/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-03-register-speech-to-text-output" {
#   filename         = "./../workflows/ai/03-register-speech-to-text-output/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-03-register-speech-to-text-output")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/03-register-speech-to-text-output/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-04-translate-speech-transcription" {
#   filename         = "./../workflows/ai/04-translate-speech-transcription/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-04-translate-speech-transcription")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/04-translate-speech-transcription/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-05-register-speech-translation" {
#   filename         = "./../workflows/ai/05-register-speech-translation/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-05-register-speech-translation")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/05-register-speech-translation/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-06a-detect-celebrities-aws" {
#   filename         = "./../workflows/ai/06a-detect-celebrities-aws/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-06a-detect-celebrities-aws")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/06a-detect-celebrities-aws/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-06b-detect-celebrities-azure" {
#   filename         = "./../workflows/ai/06b-detect-celebrities-azure/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-06b-detect-celebrities-azure")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/06a-detect-celebrities-aws/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-07a-register-celebrities-info-aws" {
#   filename         = "./../workflows/ai/07a-register-celebrities-info-aws/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-07a-register-celebrities-info-aws")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/07a-register-celebrities-info-aws/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# resource "aws_lambda_function" "ai-07b-register-celebrities-info-azure" {
#   filename         = "./../workflows/ai/07b-register-celebrities-info-azure/dist/lambda.zip"
#   function_name    = "${format("%.64s", "${var.global_prefix}-ai-07b-register-celebrities-info-azure")}"
#   role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
#   handler          = "index.handler"
#   source_code_hash = "${base64sha256(file("./../workflows/ai/07b-register-celebrities-info-azure/dist/lambda.zip"))}"
#   runtime          = "nodejs8.10"
#   timeout          = "30"
#   memory_size      = "256"
# }

# #################################
# #  Step Functions : AI Workflow
# #################################

# data "template_file" "ai-workflow" {
#   template = "${file("workflows/ai.json")}"

#   vars {
#     lambda-01-validate-workflow-input          = "${aws_lambda_function.ai-01-validate-workflow-input.arn}"
#     lambda-02-extract-speech-to-text           = "${aws_lambda_function.ai-02-extract-speech-to-text.arn}"
#     lambda-03-register-speech-to-text-output   = "${aws_lambda_function.ai-03-register-speech-to-text-output.arn}"
#     lambda-04-translate-speech-transcription   = "${aws_lambda_function.ai-04-translate-speech-transcription.arn}"
#     lambda-05-register-speech-translation      = "${aws_lambda_function.ai-05-register-speech-translation.arn}"
#     lambda-06a-detect-celebrities-aws          = "${aws_lambda_function.ai-06a-detect-celebrities-aws.arn}"
#     lambda-06b-detect-celebrities-azure        = "${aws_lambda_function.ai-06b-detect-celebrities-azure.arn}"
#     lambda-07a-register-celebrities-info-aws   = "${aws_lambda_function.ai-07a-register-celebrities-info-aws.arn}"
#     lambda-07b-register-celebrities-info-azure = "${aws_lambda_function.ai-07b-register-celebrities-info-azure.arn}"
#     job-completion-activity                    = "${aws_sfn_activity.job_completion_activity.id}"
#   }
# }

# resource "aws_sfn_state_machine" "ai-workflow" {
#   name       = "${var.global_prefix}-ai-workflow"
#   role_arn   = "${aws_iam_role.iam_for_state_machine_execution.arn}"
#   definition = "${data.template_file.ai-workflow.rendered}"
# }
