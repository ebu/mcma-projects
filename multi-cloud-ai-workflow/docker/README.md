# Transformation Service Docker

Docker Wrapper for Transformation Service

## Development

### Prerequisites

* [Docker](https://store.docker.com/editions/community/docker-ce-desktop-windows)
* [NodeJS >= 8.10.0](https://nodejs.org/)

1. Run ``npm install`` from docker directory
2. Edit ``docker-helper.sh`` => Set your [Docker Hub](https://hub.docker.com/) credentials in `DOCKER_USER` and `DOCKER_PASSWORD`


### Run
|Action|Command|Notes|
|:---:|:---:|:---:|
|Start| ``./docker-helper.sh start``||
|Stop |``./docker-helper.sh stop``||
|Build| ``./docker-helper.sh build``|Stops the docker if running before build process and automatically restarts it|
|Push| ``./docker-helper.sh push``|Push the docker to Docker Hub|
|delete-local |``./docker-helper.sh delete-local``|Deletes the docker from local registry|



