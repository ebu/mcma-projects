/* App servers */
resource "aws_instance" "app" {
  count             = 1
  ami               = "${lookup(var.amis, var.aws_region)}"
  instance_type     = "${var.aws_instance_type}"
  subnet_id         = "${aws_subnet.private.id}"
  security_groups   = ["${aws_security_group.default.id}"]
  key_name          = "${aws_key_pair.deployer.key_name}"
  source_dest_check = false
  user_data         = "${file("cloud-config/app.yml")}"
  tags = {
    Name = "mcma-app-${count.index}"
  }
}

/* Load balancer */
resource "aws_elb" "app" {
  name            = "mcma-elb"
  subnets         = ["${aws_subnet.public.id}"]
  security_groups = ["${aws_security_group.default.id}", "${aws_security_group.web.id}"]
  listener {
    instance_port     = 80
    instance_protocol = "http"
    lb_port           = 80
    lb_protocol       = "http"
  }
  instances = ["${aws_instance.app.*.id}"]
}
