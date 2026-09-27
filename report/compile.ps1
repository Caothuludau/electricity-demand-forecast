# Build the report from this folder:  powershell -File compile.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$job = "main"
foreach ($pass in 1..3) {
    Write-Host "==> pdflatex pass $pass"
    pdflatex -interaction=nonstopmode -halt-on-error -file-line-error $job
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "==> $job.pdf built"
