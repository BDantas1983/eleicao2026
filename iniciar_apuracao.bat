@echo off
setlocal
cd /d "%~dp0"
title Apuracao 2º Turno 2026 - Comparativo em Tempo Real

echo ======================================================
echo   APURACAO 2º TURNO BRASIL 2026 - COMPARATIVO AO VIVO
echo ======================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERRO] Python nao foi encontrado no PATH do Windows!
        echo Por favor, instale o Python ou adicione-o ao PATH.
        echo.
        pause
        exit /b 1
    ) else (
        set PY_CMD=py
    )
) else (
    set PY_CMD=python
)

echo [1/2] Abrindo navegador em http://localhost:8000...
start "" "http://localhost:8000"

echo [2/2] Iniciando servidor local...
echo.
echo Para encerrar o servidor a qualquer momento, feche esta janela ou pressione Ctrl+C.
echo.
%PY_CMD% server.py

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O servidor encerrou com codigo %errorlevel%.
    pause
)
