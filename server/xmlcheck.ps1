param([Parameter(Mandatory=$true)][string]$DocPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$abs = (Resolve-Path -LiteralPath $DocPath).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($abs)
$entry = $zip.GetEntry('word/document.xml')
$reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

$settings = New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Ignore
$settings.XmlResolver = $null
$r = [System.Xml.XmlReader]::Create((New-Object System.IO.StringReader($xml)), $settings)
try {
  while ($r.Read()) { }
  Write-Output 'STRICT XML PARSE: OK'
} catch {
  Write-Output ("STRICT XML PARSE FAILED: " + $_.Exception.Message)
} finally {
  $r.Close()
}
