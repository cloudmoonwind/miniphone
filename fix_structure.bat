@echo off
echo Fixing file structure...

if not exist server\repositories mkdir server\repositories

if exist FileCharacterRepository.js move FileCharacterRepository.js server\repositories\
if exist FileConversationRepository.js move FileConversationRepository.js server\repositories\
if exist FileHelper.js move FileHelper.js server\repositories\

if exist index.js (
    findstr "FileCharacterRepository" index.js >nul
    if not errorlevel 1 move index.js server\repositories\
)

echo Done. Please run 'npm run dev' in server directory again.
pause