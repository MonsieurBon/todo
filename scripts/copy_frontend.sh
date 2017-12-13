#!/bin/bash

cp frontend/dist/index.html app/Resources/views/default/index.html.twig
rm -rf web/assets
mv frontend/dist/assets web/assets
cp frontend/dist/*.js web/assets
cp frontend/dist/*.css web/assets
cp frontend/dist/favicon.ico web/favicon.ico

