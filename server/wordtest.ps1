$ErrorActionPreference = 'Stop'
$docx = (Resolve-Path -LiteralPath "documents\drive\OneBridge HRMS\Employees\EMP-0001 - AVALA SRI VENKATA GAGNGA VINAY\Acceptance\Internship_Offer_Letter.docx").Path
$out = "$env:TEMP\onebridge-wordtest"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
$pdf = Join-Path $out 'document.pdf'
$log = Join-Path $out 'result.txt'
"docx: $docx" | Out-File $log
$w = $null
try {
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.DisplayAlerts = 0
  "before open" | Out-File $log -Append
  $d = $w.Documents.Open($docx)
  "after open: name=$($d.Name) pages=$($d.ComputeStatistics(2))" | Out-File $log -Append
  $d.SaveAs2($pdf, 17)
  "after save: exists=$([bool](Test-Path $pdf))" | Out-File $log -Append
  $d.Close(0)
  "closed" | Out-File $log -Append
} catch {
  "ERROR: $($_.Exception.Message)" | Out-File $log -Append
  if ($_.Exception.InnerException) { "INNER: $($_.Exception.InnerException.Message)" | Out-File $log -Append }
} finally {
  if ($w) { try { $w.Quit() } catch {} }
}
Get-Content $log
