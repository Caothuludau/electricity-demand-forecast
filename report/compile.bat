@echo off
cd /d "%~dp0"
where pdflatex >nul 2>&1
if errorlevel 1 (
  echo pdflatex was not found. Install MiKTeX or TeX Live, then run this file again.
  exit /b 1
)
for %%P in (1 2 3) do (
  echo ==^> pdflatex pass %%P
  pdflatex -interaction=nonstopmode -halt-on-error -file-line-error main
  if errorlevel 1 exit /b 1
)
echo ==^> main.pdf built
