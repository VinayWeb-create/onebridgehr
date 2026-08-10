$ErrorActionPreference = 'Stop'
$log = "$env:TEMP\worddiag.txt"
"== $(Get-Date -Format HH:mm:ss) ==" | Out-File $log
$w = $null
try {
  $w = New-Object -ComObject Word.Application
  $w.Visible = $false
  $w.DisplayAlerts = 0
  "created, visible set" | Out-File $log -Append
  $prod = $null; try { $prod = $w.ProductCode } catch { $prod = "ERR $($_.Exception.Message)" }
  "ProductCode: $prod" | Out-File $log -Append
  $name = $null; try { $name = $w.UserControl } catch { $name = "ERR" }
  "UserControl: $name" | Out-File $log -Append
  $d = $w.Documents.Open('C:\Users\user\Downloads\Corporate Email Signature Design - Figma Make_files\Accepetence_letter.docx', $false, $true)
  "opened: $($d.Name)" | Out-File $log -Append
  $d.Close(0)
  "closed doc" | Out-File $log -Append
  $w.Quit()
  $w = $null
  "quit ok" | Out-File $log -Append
} catch {
  "ERROR: $($_.Exception.Message)" | Out-File $log -Append
} finally {
  if ($w) { try { $w.Quit() } catch { "quit-err" | Out-File $log -Append } }
  "done" | Out-File $log -Append
}
Get-Content $log
