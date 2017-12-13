#!/bin/bash


docker login -u="$1" -p="$2"
yarn deploy
docker build -t todo .
docker images
docker tag todo $DOCKER_USER/todo:latest
docker tag todo $DOCKER_USER/todo:$3
docker push $DOCKER_USER/todo:latest
docker push $DOCKER_USER/todo:$3