resource "aws_key_pair" "deployer" {
  key_name   = "deployer-key"
  public_key = "${file("ec2/ssh/deployer-key.pub")}"
}
