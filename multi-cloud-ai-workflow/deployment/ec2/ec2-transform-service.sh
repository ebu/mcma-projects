#!/bin/bash

VAR_FILE=terraform.tfvars
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
RETVAL=0

start() {
	echo 'Starting EC2 Transform Service deployment..'
	checkIfInstalled terraform
	cd "$DIR"
	terraform apply -var-file=../$VAR_FILE -auto-approve
}

stop() {
	echo 'Stopping EC2 Transform Service deployment..'
	checkIfInstalled terraform
	cd "$DIR"
	terraform destroy -var-file=../$VAR_FILE -auto-approve
}

state(){
	checkIfInstalled terraform
	cd "$DIR"

	ELB_STATE=$(terraform state show aws_elb.app)

	# Check if load balancer started
	if [[ ! -z ${ELB_STATE} ]]
		then
			DNS=$(echo ${ELB_STATE} | sed 's/.*dns_name = //' | sed 's/ .*//')

			# Try to reach EC2 App
			if [[ ! -z ${DNS} ]]
				then
					HTTP_CODE=$(curl -s -o /dev/null -I -w "%{http_code}" http://${DNS}/)

					# Check HTTP_CODE
					case ${HTTP_CODE} in
						200)
							REQUEST="\e[32m${HTTP_CODE}\e[0m"
							SERVICE="\e[32mRunning\e[0m"
							;;
						*)
							REQUEST="\e[31m${HTTP_CODE}\e[0m"
							SERVICE="\e[33mNot reachable\e[0m"
							;;
					esac
			else
				SERVICE="\e[34mDeploying...\e[0m"
			fi
		else
			SERVICE="\e[31mOffline\e[0m"
			REQUEST="-"
			DNS="-"

	fi

	echo -e "Service     = ${SERVICE}"
	echo -e "Request     = ${REQUEST}"
	echo -e "Hostname    = ${DNS}"
}


checkIfInstalled() {
	command -v $1 >/dev/null 2>&1 || {
		echo >&2 "I require $1 but it's not installed.  Aborting.";
		exit 1;
	}
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    state)
        state
        ;;
    *)
        echo $"Usage: terraform {start|stop|state}"
        RETVAL=2
    esac

    exit $RETVAL