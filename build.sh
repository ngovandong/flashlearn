#!/bin/bash
docker build -t flashlearn:latest .
docker tag flashlearn:latest ngovandong/flashlearn:latest
docker push ngovandong/flashlearn:latest
