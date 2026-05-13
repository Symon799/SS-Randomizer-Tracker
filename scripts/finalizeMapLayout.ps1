Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select exported SSHD map layout overrides'
$dialog.Filter = 'JSON files (*.json)|*.json|All files (*.*)|*.*'
$downloadsPath = Join-Path $env:USERPROFILE 'Downloads'
if (Test-Path $downloadsPath) {
    $dialog.InitialDirectory = $downloadsPath
}
else {
    $dialog.InitialDirectory = [Environment]::GetFolderPath('MyDocuments')
}
$dialog.RestoreDirectory = $true

$result = $dialog.ShowDialog()
if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host 'No override file selected.'
    exit 1
}

$selectedFile = $dialog.FileName
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    node .\scripts\applyMapLayoutOverrides.mjs "$selectedFile" --disable-debug
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Map layout applied and debug mode disabled.'
Read-Host 'Press Enter to close'
