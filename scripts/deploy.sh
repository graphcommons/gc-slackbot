#!/bin/bash

pm2 stop start-with-newrelic

git fetch origin
git merge origin/master

npm install

pm2 start start-with-newrelic
