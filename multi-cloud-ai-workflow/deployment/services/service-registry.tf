
resource "aws_lambda_function" "service-registry-api-handler" {
  filename         = "./../services/service-registry/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-service-registry-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../services/service-registry/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}
