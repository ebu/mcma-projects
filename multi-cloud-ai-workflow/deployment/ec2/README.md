# EC2 Deployment

Terraform based ec2 instance launcher for transform service docker

## Development

### Prerequisites

* [Terraform](https://www.terraform.io/downloads.html)
* Run ``terraform init`` in `/ec2` directory
* Valid ``gradle.properties`` file with AWS credentials in root directory
* Set the path to Docker Repository in ``cloud-config/app.yml`` (TODO: Should be bound to variable)

### Run
|Action|Command|Notes|
|---|---|---|
|Start EC2 Deployment|`./ec2-transform-service.sh start`||
|Stop EC2 Deployment|`./ec2-transform-service.sh stop`||
|Get Service / Deployment State|`./ec2-transform-service.sh state`|Returns hostname, service state, request response|