param([string]$DocPath)
$ErrorActionPreference = 'Stop'
$out = "$env:TEMP\onebridge-wordtest2"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
$pdf = Join-Path $out 'out.pdf'
Remove-Item $pdf -ErrorAction SilentlyContinue
$log = Join-Path $out 'result.txt'
$ts = Get-Date -Format 'HH:mm:ss.fff'
"[$ts] start doc=$DocPath" | Out-File $log
$w = $null
try {
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.ScreenUpdating = $false
  $w.DisplayAlerts = 0
  "after create" | Out-File $log -Append
  $d = $w.Documents.Open($DocPath, $false, $true)   # read-only
  "after open name=$($d.Name)" | Out-File $log -Append
  $d.ExportAsFixedFormat($pdf, 17)                   # 17 = wdExportFormatPDF
  "after export exists=$([bool](Test-Path $pdf)) size=$((Get-Item $pdf -ErrorAction SilentlyContinue).Length)" | Out-File $log -Append
  $d.Close(0)
  "after close" | Out-File $log -Append
} catch {
  "ERROR: $($_.Exception.Message)" | Out-File $log -Append
  if ($_.Exception.InnerException) { "INNER: $($_.Exception.InnerException.Message)" | Out-File $log -Append }
} finally {
  if ($w) { try { $w.Quit() } catch { "QUIT ERR: $($_.Exception.Message)" | Out-File $log -Append } }
  "done" | Out-File $log -Append
}
Get-Content $log
