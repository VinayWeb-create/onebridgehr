$ErrorActionPreference = 'Stop'
$log = "$env:TEMP\worddiag2.txt"
"== $(Get-Date -Format HH:mm:ss) ==" | Out-File $log
$w = $null
try {
  $docx = (Resolve-Path -LiteralPath "documents\drive\OneBridge HRMS\Employees\EMP-0001 - AVALA SRI VENKATA GAGNGA VINAY\Acceptance\Internship_Offer_Letter.docx").Path
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.ScreenUpdating = $false
  $w.DisplayAlerts = 0
  $d = $w.Documents.Open($docx, $false, $true)
  "opened: $($d.Name) pages=$($d.ComputeStatistics(2))" | Out-File $log -Append
  $d.SaveAs2("$env:TEMP\worddiag2_out.docx", 16)
  "saved docx16" | Out-File $log -Append
  $d.Close(0)
  $w.Quit(); $w = $null
  "quit ok" | Out-File $log -Append
} catch {
  "ERROR: $($_.Exception.Message)" | Out-File $log -Append
} finally {
  if ($w) { try { $w.Quit() } catch {} }
  "done" | Out-File $log -Append
}
Get-Content $log
