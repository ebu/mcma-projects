resource "aws_ecs_task_definition" "benchmarkstt" {
  family = "${var.global_prefix}-benchmarkstt"

  container_definitions = templatefile("${path.module}/benchmarkstt.json", {
    log_group_name = var.log_group.name
    aws_region     = var.aws_region
  })

  cpu          = 256
  memory       = 512
  network_mode = "awsvpc"

  execution_role_arn = aws_iam_role.ecs_task_execution.arn

  requires_compatibilities = ["FARGATE"]
}

resource "aws_ecs_service" "benchmarkstt" {
  name            = "${var.global_prefix}-benchmarkstt"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.benchmarkstt.arn
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public.id]
    security_groups  = [aws_security_group.allow_inbound_8080.id]
    assign_public_ip = true
  }

  desired_count = 1
}

