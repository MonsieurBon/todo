#!/bin/bash

cp frontend/dist/index.html templates/default/index.html.twig
rm -rf public/assets
rm public/*.js
rm public/*.css
rm public/*.json
rm public/favicon.ico
cp -r frontend/dist/assets public/assets
cp frontend/dist/*.js public
cp frontend/dist/*.css public
cp frontend/dist/*.json public
cp frontend/dist/favicon.ico public/favicon.ico

