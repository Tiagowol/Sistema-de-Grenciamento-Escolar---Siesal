@echo off
chcp 65001 > nul
title SIESAL - Console de Debug e Servidor
color 0B

echo ========================================================================
echo   SIESAL - INICIANDO O CONSOLE DE DEBUG & SERVIDOR EXPRESS
echo ========================================================================
echo.

cd /d "%~dp0backend"
npm run console

pause
