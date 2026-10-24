$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$package = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = $package.version
$sevenZip = Join-Path $root 'tools\7zip\7z.exe'
$rcedit = Join-Path $root 'tools\rcedit.exe'
$sfxModule = Join-Path $root 'tools\7zip\7z.sfx'
$icon = Join-Path $root 'build\icon.ico'

foreach ($tool in @($sevenZip, $rcedit, $sfxModule, $icon)) {
  if (!(Test-Path $tool)) {
    throw "缺少打包工具：$tool。请先准备 tools/ 下的 7-Zip、rcedit 与 build/icon.ico。"
  }
}

Write-Host '1/6 构建前端与主进程…'
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'electron-vite 构建失败' }

$release = Join-Path $root 'release'
$dest = Join-Path $release "AMCL-$version-win-x64"
$archive = Join-Path $release 'AMCL.7z'
$zip = Join-Path $release "AMCL-$version-win-x64.zip"
$portable = Join-Path $release "AMCL-Portable-$version.exe"

Write-Host '2/6 组装客户端目录…'
if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $root 'node_modules\electron\dist\*') $dest -Recurse -Force
Rename-Item (Join-Path $dest 'electron.exe') 'AMCL.exe'
Remove-Item (Join-Path $dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue

$app = Join-Path $dest 'resources\app'
New-Item -ItemType Directory -Force (Join-Path $app 'node_modules') | Out-Null
Copy-Item (Join-Path $root 'out') $app -Recurse -Force
Copy-Item (Join-Path $root 'node_modules\adm-zip') (Join-Path $app 'node_modules') -Recurse -Force
if (Test-Path (Join-Path $root 'resources')) {
  Copy-Item (Join-Path $root 'resources') $app -Recurse -Force
}

$runtimePackage = @"
{
  "name": "amcl-launcher",
  "version": "$version",
  "description": "AMCL - A modern Minecraft launcher for Windows",
  "main": "out/main/index.js",
  "author": "AMCL Team",
  "license": "MIT"
}
"@
[System.IO.File]::WriteAllText((Join-Path $app 'package.json'), $runtimePackage, (New-Object System.Text.UTF8Encoding($false)))

Write-Host '3/6 写入 Windows 图标与版本信息…'
& $rcedit (Join-Path $dest 'AMCL.exe') --set-icon $icon `
  --set-file-version $version --set-product-version $version `
  --set-version-string 'ProductName' 'AMCL' `
  --set-version-string 'FileDescription' 'AMCL Minecraft Launcher' `
  --set-version-string 'CompanyName' 'AMCL Team' `
  --set-version-string 'LegalCopyright' 'Copyright (c) 2026 AMCL Team' `
  --set-version-string 'OriginalFilename' 'AMCL.exe'
if ($LASTEXITCODE -ne 0) { throw 'rcedit 写入图标失败' }

Write-Host '4/6 生成便携压缩包…'
Remove-Item $archive, $zip, $portable -Force -ErrorAction SilentlyContinue
& $sevenZip a -t7z -mx=5 -mmt=on $archive "$dest\*" | Out-Null
if ($LASTEXITCODE -ne 0) { throw '7-Zip 压缩失败' }

Write-Host '5/6 生成单文件便携版…'
$stub = Join-Path $root 'tools\sfx-stub.exe'
Copy-Item $sfxModule $stub -Force
& $rcedit $stub --set-icon $icon `
  --set-file-version $version --set-product-version $version `
  --set-version-string 'ProductName' 'AMCL' `
  --set-version-string 'FileDescription' 'AMCL Minecraft Launcher (Portable)' `
  --set-version-string 'CompanyName' 'AMCL Team' `
  --set-version-string 'LegalCopyright' 'Copyright (c) 2026 AMCL Team' `
  --set-version-string 'OriginalFilename' "AMCL-Portable-$version.exe"
if ($LASTEXITCODE -ne 0) { throw 'rcedit 写入 SFX 图标失败' }

$config = ";!@Install@!UTF-8!`r`nTitle=`"AMCL 我的世界启动器`"`r`nGUIMode=`"2`"`r`nRunProgram=`"AMCL.exe`"`r`n;!@InstallEnd@!`r`n"
$configFile = Join-Path $root 'tools\sfx-config.txt'
[System.IO.File]::WriteAllText($configFile, $config, (New-Object System.Text.UTF8Encoding($false)))

$out = [System.IO.File]::Open($portable, [System.IO.FileMode]::Create)
try {
  foreach ($part in @($stub, $configFile, $archive)) {
    $bytes = [System.IO.File]::ReadAllBytes($part)
    $out.Write($bytes, 0, $bytes.Length)
  }
} finally {
  $out.Close()
}

Write-Host '6/6 生成 ZIP 与校验值…'
& $sevenZip a -tzip -mx=5 -mmt=on $zip "$dest\*" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'ZIP 压缩失败' }
Remove-Item $archive -Force -ErrorAction SilentlyContinue

$hashes = Get-FileHash $portable, $zip -Algorithm SHA256
$hashes | ForEach-Object { "$($_.Hash.ToLower())  $([System.IO.Path]::GetFileName($_.Path))" } |
  Set-Content -Encoding ASCII (Join-Path $release 'SHA256SUMS.txt')

Write-Host ''
Write-Host '打包完成：'
Get-Item $portable, $zip | Select-Object Name, @{ N = 'SizeMB'; E = { [math]::Round($_.Length / 1MB, 1) } }, FullName |
  Format-Table -AutoSize
