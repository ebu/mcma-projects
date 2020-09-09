resource "aws_cloudwatch_log_group" "main" {
  name = "/mcma/${var.global_prefix}"
}

resource "aws_cloudwatch_metric_alarm" "jobs_failed" {
  alarm_name          = "${var.global_prefix}-jobs-failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "JobsFailed"
  namespace           = var.global_prefix
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric detects job failures. Check the dashboard at https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.global_prefix} to see which job failed."
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.jobs_failed.arn]
}

resource "aws_sns_topic" "jobs_failed" {
  name = "${var.global_prefix}-jobs-failed"
}

