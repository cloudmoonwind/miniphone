@echo off
mkdir server\data 2>nul
mkdir server\repositories 2>nul
mkdir client\src\components 2>nul
mkdir client\src\assets 2>nul

if exist index.js (
    findstr "FileCharacterRepository" index.js >nul
    if not errorlevel 1 move index.js server\repositories\
    if errorlevel 1 move index.js server\
)
if exist package.json (
    findstr "ics-mvp-client" package.json >nul
    if not errorlevel 1 move package.json client\
)
if exist vite.config.js move vite.config.js client\
if exist tailwind.config.js move tailwind.config.js client\
if exist postcss.config.js move postcss.config.js client\
if exist index.html move index.html client\
if exist index.css move index.css client\src\
if exist main.jsx move main.jsx client\src\
if exist App.jsx move App.jsx client\src\

if exist FileCharacterRepository.js move FileCharacterRepository.js server\repositories\
if exist FileConversationRepository.js move FileConversationRepository.js server\repositories\
if exist FileHelper.js move FileHelper.js server\repositories\

echo Setup complete.
pause