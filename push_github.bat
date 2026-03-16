@echo off
:: Obtener fecha y hora formateada
for /f "tokens=1-5 delims=/: " %%a in ("%date% %time%") do (
    set yyyy=%%c
    set mm=%%a
    set dd=%%b
    set hh=%%d
    set min=%%e
)

:: Formato final: YYYYMMDD_HHMM
set commitmsg=%yyyy%%mm%%dd%_%hh%%min%

:: Ejecutar comandos Git
echo ============================
echo Commit automatico: %commitmsg%
echo ============================

git add .
git commit -m "%commitmsg%"
git push

echo ----------------------------
echo Subido a GitHub con exito.
pause