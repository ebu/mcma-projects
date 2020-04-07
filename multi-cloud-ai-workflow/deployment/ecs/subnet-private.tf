resource "aws_subnet" "private" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"

  tags = {
    Name = "${var.global_prefix}-private"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_nat_gateway.gw[0].id
  }

  tags = {
    Name = "${var.global_prefix}-private"
  }

  count = var.enabled ? 1 : 0
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private[0].id

  count = var.enabled ? 1 : 0
}
