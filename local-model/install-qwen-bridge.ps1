param([Parameter(Mandatory=$true)][string]$QwenLocalPath)
$ErrorActionPreference = 'Stop'
$targetRoot = (Resolve-Path -LiteralPath $QwenLocalPath).Path
if (!(Test-Path -LiteralPath (Join-Path $targetRoot 'app.py') -PathType Leaf)) { throw '该目录不是 QwenLocal 程序目录：缺少 app.py。' }
$staticPath = Join-Path $targetRoot 'static'
if (!(Test-Path -LiteralPath $staticPath -PathType Container)) { throw '该目录缺少 static 文件夹。' }
$sourcePath = Join-Path $PSScriptRoot 'qwen-rewrite-bridge.html'
$targetPath = Join-Path $staticPath 'feishui-rewrite-bridge-v1.html'
Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
Write-Output ('连接页已安装：' + $targetPath)
Write-Output '不用重启已运行的模型。在编辑器中选择「本地 QwenLocal」，点击「测试连接」即可。'
