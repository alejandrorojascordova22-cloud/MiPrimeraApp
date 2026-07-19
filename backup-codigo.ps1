# backup-codigo.ps1
# Empaqueta solo el codigo fuente del proyecto (como el "lib.zip" de Flutter),
# sin node_modules, .expo, .vscode ni carpetas de compilacion.
#
# Uso: colocalo en la raiz de MiPrimeraApp y corre en PowerShell:
#   .\backup-codigo.ps1

$origen = Get-Location
$fecha = Get-Date -Format "yyyy-MM-dd_HHmm"
$zipSalida = Join-Path $origen "codigo_$fecha.zip"

# Carpetas y archivos que SI queremos compartir (el "codigo fuente" real)
$incluir = @(
  "app",
  "components",
  "constants",
  "hooks",
  "services",
  "types",
  "utils",
  "assets",
  "package.json",
  "app.json",
  "tsconfig.json",
  "eslint.config.js"
)

# Carpeta temporal donde copiamos solo lo necesario
$temp = Join-Path $env:TEMP "codigo_temp_$fecha"
New-Item -ItemType Directory -Path $temp | Out-Null

foreach ($item in $incluir) {
  $rutaCompleta = Join-Path $origen $item
  if (Test-Path $rutaCompleta) {
    Copy-Item $rutaCompleta -Destination $temp -Recurse
    Write-Host "Agregado: $item"
  } else {
    Write-Host "No encontrado (se omite): $item" -ForegroundColor Yellow
  }
}

# Comprimir
Compress-Archive -Path "$temp\*" -DestinationPath $zipSalida -Force

# Limpiar temporal
Remove-Item $temp -Recurse -Force

Write-Host ""
Write-Host "Listo. Zip creado en:" -ForegroundColor Green
Write-Host $zipSalida
