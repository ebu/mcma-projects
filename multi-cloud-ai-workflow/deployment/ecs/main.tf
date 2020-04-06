resource "aws_ecs_cluster" "main" {
  name = var.global_prefix
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = format("%.64s", "${var.global_prefix}.${var.aws_region}.ecs.task_execution")
  assume_role_policy = file("policies/assume-role-ecs-tasks.json")
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
