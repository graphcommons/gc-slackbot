#!/bin/bash

pm2 stop start-with-newrelic

git fetch origin
git merge origin/master

if git diff --name-only HEAD@{1} HEAD package.json | grep -e 'package.json'; then
  npm install
fi

pm2 start start-with-newrelic
