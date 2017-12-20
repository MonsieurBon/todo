#!/bin/bash

cp frontend/dist/index.html templates/default/index.html.twig
rm -rf public/assets
mv frontend/dist/assets public/assets
cp frontend/dist/*.js public/assets
cp frontend/dist/*.css public/assets
cp frontend/dist/favicon.ico public/favicon.ico

