resource "aws_cloudwatch_log_group" "main" {
  name = var.global_prefix
}

resource "aws_cloudwatch_log_metric_filter" "jobs_started" {
  name           = "${var.global_prefix}-type-JOB_START"
  pattern        = "{ $.type = \"JOB_START\" }"
  log_group_name = aws_cloudwatch_log_group.main.name

  metric_transformation {
    name          = "JobsStarted"
    namespace     = var.global_prefix
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "jobs_completed" {
  name           = "${var.global_prefix}-message-jobStatus-Completed"
  pattern        = "{ $.type = \"JOB_END\" && $.message.jobStatus = \"Completed\" }"
  log_group_name = aws_cloudwatch_log_group.main.name

  metric_transformation {
    name          = "JobsCompleted"
    namespace     = var.global_prefix
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "jobs_failed" {
  name           = "${var.global_prefix}-message-jobStatus-Failed"
  pattern        = "{ $.type = \"JOB_END\" && $.message.jobStatus = \"Failed\" }"
  log_group_name = aws_cloudwatch_log_group.main.name

  metric_transformation {
    name          = "JobsFailed"
    namespace     = var.global_prefix
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "jobs_canceled" {
  name           = "${var.global_prefix}-message-jobStatus-Canceled"
  pattern        = "{ $.type = \"JOB_END\" && $.message.jobStatus = \"Canceled\" }"
  log_group_name = aws_cloudwatch_log_group.main.name

  metric_transformation {
    name          = "JobsCanceled"
    namespace     = var.global_prefix
    value         = "1"
    default_value = "0"
  }
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

resource "aws_cloudwatch_dashboard" "dashboard" {
  dashboard_name = var.global_prefix
  dashboard_body = templatefile("${path.module}/dashboard.json", {
    global_prefix = var.global_prefix
    aws_region    = var.aws_region
  })
}
