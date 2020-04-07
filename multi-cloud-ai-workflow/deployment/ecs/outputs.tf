output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "benchmarkstt_service_name" {
  value = aws_ecs_service.benchmarkstt.name
}

output "private_subnet_id" {
  value = aws_subnet.private.id
}

output "default_security_group_id" {
  value = aws_default_security_group.default.id
}
