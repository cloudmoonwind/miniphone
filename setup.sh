#!/bin/bash

# 创建目录结构
mkdir -p server/data
mkdir -p client/src/components
mkdir -p client/src/assets

# 自动整理文件 (如果文件在根目录)
[ -f "index.js" ] && mv index.js server/
[ -f "package.json" ] && grep -q "ics-client" package.json && mv package.json client/
[ -f "vite.config.js" ] && mv vite.config.js client/
[ -f "tailwind.config.js" ] && mv tailwind.config.js client/
[ -f "postcss.config.js" ] && mv postcss.config.js client/
[ -f "index.html" ] && mv index.html client/
[ -f "index.css" ] && mv index.css client/src/
[ -f "main.jsx" ] && mv main.jsx client/src/
[ -f "App.jsx" ] && mv App.jsx client/src/

echo "目录结构已创建"
echo "请分别在 server 和 client 目录下运行 npm install"
echo "然后分别运行 npm run dev"