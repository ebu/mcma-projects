output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "benchmarkstt_service_name" {
  value = aws_ecs_service.benchmarkstt.name
}
