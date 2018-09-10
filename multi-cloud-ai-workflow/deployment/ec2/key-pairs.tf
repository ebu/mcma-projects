resource "aws_key_pair" "deployer" {
  key_name   = "${var.global_prefix}-deployer-key"
  public_key = "${file("ec2/ssh/deployer-key.pub")}"
}
