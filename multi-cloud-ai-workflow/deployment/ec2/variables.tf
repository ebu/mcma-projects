variable "aws_access_key" {
  description = "INPUT your AWS access_key"
}

variable "aws_secret_key" {
  description = "INPUT your AWS secret_key"
}

variable "aws_instance_type" {
  description = "Instance type that should be launched"
  default     = "t2.micro"
}

variable "aws_instance_count" {
  description = "Instance type that should be launched"
  default     = "1"
}

variable "aws_region" {
  description = "AWS region to host your network"
  default     = "eu-west-1"
}

variable "aws_vpc_cidr" {
  description = "CIDR for VPC"
  default     = "10.128.0.0/16"
}

variable "aws_ec2_public_subnet_cidr" {
  description = "CIDR for public subnet"
  default     = "10.128.0.0/24"
}

variable "aws_ec2_private_subnet_cidr" {
  description = "CIDR for private subnet"
  default     = "10.128.1.0/24"
}

variable "aws_account_id" {}
variable "global_prefix" {}

variable "services_url" {}
variable "services_auth_type" {}
variable "services_auth_context" {}

/* Ubuntu 16.04 amis by region */
variable "amis" {
  description = "Base AMI to launch the instances with"

  default = {
    us-west-1      = "ami-049d8641"
    us-east-1      = "ami-a6b8e7ce"
    us-east-2      = "ami-12a88d77"
    us-east-1      = "ami-04169656fea786776"
    us-west-1      = "ami-059e7901352ebaef8"
    ap-northeast-1 = "ami-02115cef40fbb46a4"
    sa-east-1      = "ami-08b78b890b5a86161"
    ap-southeast-1 = "ami-03221428e6676db69"
    ca-central-1   = "ami-9526abf1"
    ap-south-1     = "ami-00b7e666605d33085"
    eu-central-1   = "ami-027583e616ca104df"
    eu-west-1      = "ami-0181f8d9b6f098ec4"
    cn-north-1     = "ami-0987442b0b3be4589"
    cn-northwest-1 = "ami-085d69987e6675f08"
    us-gov-west-1  = "ami-3a4dd15b"
    ap-northeast-2 = "ami-00ca7ffe117e2fe91"
    ap-southeast-2 = "ami-059b78064586da1b7"
    us-west-2      = "ami-51537029"
    us-east-2      = "ami-0552e3455b9bc8d50"
    eu-west-2      = "ami-c7ab5fa0"
    ap-northeast-3 = "ami-06ad95b4dfffa1d22"
    eu-west-3      = "ami-0370f4064dbc392b9"
  }
}
