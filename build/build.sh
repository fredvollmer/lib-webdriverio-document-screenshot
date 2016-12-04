#!/bin/bash

echo "Ensuring correct node version:"
source ${NVM_DIR}/nvm.sh
nvm install 4.4.4 || nvm use 4.4.4

NODE_ENV=development npm install

npm run lint

if [ $? -ne 0 ]; then
    echo "Eslint failed"; exit 1
fi

npm run install-bower

if [ $? -ne 0 ]; then
    echo "Installing test site bower failed"; exit 1
fi

npm test

if [ $? -ne 0 ]; then
   echo "Node build error!"; exit 1
fi

exit 0