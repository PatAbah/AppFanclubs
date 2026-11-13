$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Drawing
$candidates = New-Object 'System.Collections.Generic.List[object]'
$warnings = New-Object 'System.Collections.Generic.List[string]'
$counts = [ordered]@{ registry = 0; startMenu = 0; store = 0; shortcuts = 0 }

function Get-StableId([string]$kind, [string]$value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($value.ToLowerInvariant()))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    return "windows.$kind.$hash"
}
function Get-NameKey([string]$name) {
    $value = $name.Trim().ToLowerInvariant() -replace '\s+', ' '
    $value = $value -replace '\s+\((x64|x86|64-bit|32-bit)\)$', ''
    return ($value -replace '\s+v?\d+(\.\d+){1,}.*$', '').Trim()
}
function Get-LocalPath([string]$value) {
    if (-not $value) { return '' }
    $value = [Environment]::ExpandEnvironmentVariables(($value -replace ',\s*-?\d+$', '').Trim('"').Trim())
    if ($value -notmatch '^[A-Za-z]:\\') { return '' }
    return $value
}
function Test-Utility([string]$name, [string]$target, [string]$aumid) {
    if ($name -match '^(uninstall\b|remove\b|readme\b)' -or $name -match '\b(help|documentation|release notes)$') { return $true }
    if ($name -match '^(Windows (PowerShell|Tools|Administrative Tools|Security|System)|Command Prompt|Registry Editor|Run|Settings|Task Manager|Control Panel|Character Map|Disk Cleanup|System Configuration|System Information|Recovery Drive|Component Services|Event Viewer|Services|ODBC Data Sources|Defragment and Optimize Drives|Windows Memory Diagnostic)(\b|$)') { return $true }
    if ($aumid -match 'windows\.immersivecontrolpanel|Microsoft\.Windows\.(ShellExperienceHost|StartMenuExperienceHost|SecHealthUI)|Microsoft\.SecHealthUI') { return $true }
    if ($target -and $target.StartsWith((Join-Path $env:WINDIR 'System32'), [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return $false
}
function Add-Candidate($candidate) {
    if (-not $candidate.name -or (Test-Utility $candidate.name $candidate.target $candidate.aumid)) { return }
    $candidate.name = $candidate.name.Trim()
    if ($candidate.name.Length -gt 100) { $candidate.name = $candidate.name.Substring(0, 100) }
    $candidates.Add($candidate)
    $counts[$candidate.source]++
}

$paths = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
foreach ($registryPath in $paths) {
    try {
        if (-not (Test-Path ($registryPath -replace '\\\*$', ''))) { continue }
        foreach ($entry in @(Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue)) {
            if (-not $entry.DisplayName -or $entry.SystemComponent -eq 1 -or $entry.ParentKeyName -or $entry.ReleaseType -match 'Update|Hotfix') { continue }
            $identifier = if ($entry.PSChildName -match '^\{[A-Fa-f0-9-]+\}$') { $entry.PSChildName } else { ([string]$entry.Publisher + ' ' + [string]$entry.DisplayName).ToLower() -replace '[^a-z0-9._ {}()+-]', '' }
            $identifier = $identifier.Trim()
            if ($identifier.Length -lt 2 -or $identifier.Length -gt 220) { $identifier = Get-StableId 'registry' $entry.PSChildName }
            $icon = Get-LocalPath $entry.DisplayIcon
            $target = if ($icon -match '\.exe$') { $icon } else { '' }
            Add-Candidate @{ name = [string]$entry.DisplayName; package = $identifier; source = 'registry'; target = $target; iconPath = $icon; aumid = ''; launchKey = '' }
        }
    } catch { $warnings.Add('Some uninstall registry entries could not be read.') }
}
$startEntries = @(); $startNames = @{}
try {
    $startEntries = @(Get-StartApps -ErrorAction Stop)
    foreach ($entry in $startEntries) { if ($entry.AppID) { $startNames[[string]$entry.AppID] = [string]$entry.Name } }
} catch { $warnings.Add('The Windows Start application catalog could not be read.') }

try {
    foreach ($package in @(Get-AppxPackage -ErrorAction Stop | Where-Object { -not $_.IsFramework -and -not $_.IsResourcePackage })) {
        if (-not $package.InstallLocation -or $package.InstallLocation.StartsWith((Join-Path $env:WINDIR 'SystemApps'), [StringComparison]::OrdinalIgnoreCase)) { continue }
        try {
            $manifest = Get-AppxPackageManifest -Package $package.PackageFullName -ErrorAction Stop
            foreach ($application in $manifest.SelectNodes('//*[local-name()="Applications"]/*[local-name()="Application"]')) {
                $aumid = [string]$package.PackageFamilyName + '!' + $application.GetAttribute('Id')
                if (-not $startNames.ContainsKey($aumid)) { continue }
                $visual = $application.SelectSingleNode('./*[local-name()="VisualElements"]'); $logo = ''
                if ($visual) { foreach ($attribute in @('Square44x44Logo', 'Square150x150Logo', 'Logo')) { if ($visual.GetAttribute($attribute)) { $logo = $visual.GetAttribute($attribute); break } } }
                $icon = if ($logo) { Get-LocalPath (Join-Path $package.InstallLocation $logo) } else { '' }
                if ($icon -and -not (Test-Path -LiteralPath $icon -PathType Leaf)) {
                    $parent = Split-Path $icon; $stem = [IO.Path]::GetFileNameWithoutExtension($icon)
                    $file = Get-ChildItem -LiteralPath $parent -Filter ($stem + '*.png') -File -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 1
                    $icon = if ($file) { $file.FullName } else { '' }
                }
                $executable = $application.GetAttribute('Executable')
                $target = if ($executable) { Get-LocalPath (Join-Path $package.InstallLocation $executable) } else { '' }
                Add-Candidate @{ name = $startNames[$aumid]; package = (Get-StableId 'aumid' $aumid); source = 'store'; target = $target; iconPath = $icon; aumid = $aumid; launchKey = '' }
            }
        } catch { } # Protected manifests still have a Start-catalog fallback.
    }
} catch { $warnings.Add('The Microsoft Store package catalog could not be read.') }

$shortcutRoots = @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('CommonPrograms')) | Select-Object -Unique
$shortcutShell = $null
try {
    $shortcutShell = New-Object -ComObject WScript.Shell
    foreach ($folder in $shortcutRoots) {
        if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
        foreach ($link in @(Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue)) {
            $shortcut = $null
            try {
                $shortcut = $shortcutShell.CreateShortcut($link.FullName)
                $target = Get-LocalPath $shortcut.TargetPath
                if (-not $target -or -not (Test-Path -LiteralPath $target -PathType Leaf)) { continue }
                $icon = Get-LocalPath $shortcut.IconLocation
                if (-not $icon) { $icon = $target }
                $arguments = [string]$shortcut.Arguments
                $launchKey = if ($arguments -match '--app(-id)?[=\s]|shell:AppsFolder') { $arguments } else { '' }
                Add-Candidate @{ name = $link.BaseName; package = (Get-StableId 'exe' ($target + '|' + $launchKey)); source = 'shortcuts'; target = $target; iconPath = $icon; aumid = ''; launchKey = $launchKey }
            } catch {} finally { if ($shortcut) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut) } }
        }
    }
} catch { $warnings.Add('Some Start menu shortcuts could not be read.') }
finally { if ($shortcutShell) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcutShell) } }
foreach ($entry in $startEntries) {
    if ($entry.AppID) { Add-Candidate @{ name = [string]$entry.Name; package = (Get-StableId 'aumid' $entry.AppID); source = 'startMenu'; target = ''; iconPath = ''; aumid = [string]$entry.AppID; launchKey = '' } }
}

$result = New-Object 'System.Collections.Generic.List[object]'
$byPackage = @{}; $byAumid = @{}; $byTarget = @{}; $byName = @{}
foreach ($candidate in $candidates) {
    $nameKey = Get-NameKey $candidate.name
    $pathKey = if ($candidate.target) { $candidate.target.ToLowerInvariant() + '|' + $candidate.launchKey.ToLowerInvariant() } else { '' }
    $existing = $null
    if ($byPackage.ContainsKey($candidate.package)) { $existing = $byPackage[$candidate.package] }
    elseif ($candidate.aumid -and $byAumid.ContainsKey($candidate.aumid)) { $existing = $byAumid[$candidate.aumid] }
    elseif ($pathKey -and $byTarget.ContainsKey($pathKey)) { $existing = $byTarget[$pathKey] }
    elseif ($byName.ContainsKey($nameKey)) {
        foreach ($possible in $byName[$nameKey]) { if (-not $candidate.target -or -not $possible.target -or $candidate.target -eq $possible.target) { $existing = $possible; break } }
    }
    if (-not $existing) {
        $existing = $candidate
        $existing.sources = New-Object 'System.Collections.Generic.List[string]'
        $existing.aliases = New-Object 'System.Collections.Generic.List[string]'
        $result.Add($existing)
        if (-not $byName.ContainsKey($nameKey)) { $byName[$nameKey] = New-Object 'System.Collections.Generic.List[object]' }
        $byName[$nameKey].Add($existing)
    }
    if (-not $existing.sources.Contains($candidate.source)) { $existing.sources.Add($candidate.source) }
    if ($candidate.package -ne $existing.package -and -not $existing.aliases.Contains($candidate.package)) { $existing.aliases.Add($candidate.package) }
    if (-not $existing.iconPath -and $candidate.iconPath) { $existing.iconPath = $candidate.iconPath }
    if (-not $existing.target -and $candidate.target) { $existing.target = $candidate.target }
    $byPackage[$candidate.package] = $existing
    if ($candidate.aumid) { $byAumid[$candidate.aumid] = $existing }
    if ($pathKey) { $byTarget[$pathKey] = $existing }
}
function Get-PngIcon([string]$file) {
    if (-not $file -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { return '' }
    $image = $null; $icon = $null; $bitmap = $null; $graphics = $null; $stream = $null
    try {
        if ([IO.Path]::GetExtension($file) -match '^\.(png|jpg|jpeg|bmp|gif)$') { $image = [Drawing.Image]::FromFile($file) }
        else { $icon = [Drawing.Icon]::ExtractAssociatedIcon($file); $image = $icon.ToBitmap() }
        $bitmap = New-Object Drawing.Bitmap(64, 64); $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, 0, 0, 64, 64)
        $stream = New-Object IO.MemoryStream; $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        return 'data:image/png;base64,' + [Convert]::ToBase64String($stream.ToArray())
    } catch { return '' }
    finally { foreach ($resource in @($graphics, $bitmap, $image, $icon, $stream)) { if ($resource) { $resource.Dispose() } } }
}
$apps = @($result | Sort-Object { $_.name } | ForEach-Object { [ordered]@{ name = $_.name; package = $_.package; icon = (Get-PngIcon $_.iconPath); aliases = @($_.aliases.ToArray()); sources = @($_.sources.ToArray()) } })
[ordered]@{ apps = $apps; complete = ($warnings.Count -eq 0); warnings = @($warnings.ToArray() | Select-Object -Unique); counts = $counts } | ConvertTo-Json -Depth 6 -Compress
