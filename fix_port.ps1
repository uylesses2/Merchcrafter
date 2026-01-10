$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($process) {
    Write-Host "Killing process $($process.OwningProcess) on port $port..." -ForegroundColor Yellow
    Stop-Process -Id $process.OwningProcess -Force
    Write-Host "Port cleared!" -ForegroundColor Green
} else {
    Write-Host "Port $port is already clear." -ForegroundColor Green
}

Write-Host "Restarting dev environment..." -ForegroundColor Cyan
npm run dev
