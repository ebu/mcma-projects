#!/bin/bash

DOCKER_USER=user
DOCKER_PASSWORD=password
AWS_ACCESS_KEY_ID=awsAccessKey
AWS_SECRET_ACCESS_KEY=awsSecretAccessKey

IMAGE_NAME=${DOCKER_USER}/mcma-ec2-transform-service
EXT_PORT=8080
INT_PORT=8080
RETVAL=0

start() {
	docker run -e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} -e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} -p ${EXT_PORT}:${INT_PORT} -d ${IMAGE_NAME}
    RET=$?
	if [ $RET -ne 0 ];
    then
        echo error code $RET
		echo Please make sure you already build the image
		exit $RET
	fi
}

stop() {

	CONTAINER_ID=$(docker ps -a -q --filter ancestor=${IMAGE_NAME} --format="{{.ID}}")

	if [[ ! -z ${CONTAINER_ID} ]]
	then
		docker rm $(docker stop ${CONTAINER_ID})
	else
		echo No instance running!
	fi
}

build() {
	stop
	docker build -t ${IMAGE_NAME} --no-cache .
	start
}

push() {
	docker login -u ${DOCKER_USER} -p ${DOCKER_PASSWORD}
	echo Please enter new version:
	read TAG
	docker tag ${IMAGE_NAME} ${IMAGE_NAME}:${TAG}
	docker push ${IMAGE_NAME}
	docker logout
}

deleteImage() {
	stop

	IMAGE_ID=$(docker images -a -q --filter reference=${IMAGE_NAME} --format="{{.ID}}")

	if [[ ! -z ${IMAGE_ID} ]]
		then
		echo You are about to delete ${IMAGE_NAME} from your local docker registry. Are your sure about that? To confirm enter \'yup\':
		read ANSWER
		if [ ${ANSWER} == 'yup' ]
			then
				docker rmi -f ${IMAGE_ID}
				echo Registry Cleared! ${IMAGE_ID}
				exit 0;
			else
				echo Aborted
				exit 1;
		fi
		else
			echo Image does not exist. Run ./docker-helper.sh build
	fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    build)
        build
        ;;
    push)
        push
        ;;
    delete-local)
        deleteImage
        ;;
    *)
        echo $"Usage: $prog {start|stop|build|push|delete-local}"
        RETVAL=2
    esac

    exit ${RETVAL}