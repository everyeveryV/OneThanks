@echo off
setlocal
cd /d "%~dp0"
set "ETH_RUNTIME=%~dp0..\.tools\ethereum-runtime\node_modules"
set "PATH=%ETH_RUNTIME%\node\bin;%ETH_RUNTIME%\.bin;%PATH%"
set "COREPACK_HOME=%~dp0..\.cache\ethereum-corepack"
set "YARN_GLOBAL_FOLDER=%~dp0..\.cache\ethereum-yarn"
set "COREPACK_ENABLE_AUTO_PIN=0"
if not exist "%ETH_RUNTIME%\node\bin\node.exe" (
  echo Missing workspace Node.js runtime. See QUICKSTART.zh-CN.md.
  exit /b 1
)
if "%~1"=="" (
  echo Usage: dev.cmd chain ^| deploy ^| start ^| test ^| compile ^| next:check-types
  exit /b 0
)
"%ETH_RUNTIME%\node\bin\node.exe" "%~dp0.yarn\releases\yarn-4.13.0.cjs" %*
exit /b %errorlevel%
