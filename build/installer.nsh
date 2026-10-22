!include "getProcessInfo.nsh"
Var pid

!macro FIND_TRIBENET_PROCESS _RETURN
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop ${_RETURN}
!macroend

!macro customCheckAppRunning
  Var /GLOBAL TribeNetProcessCheck
  StrCpy $CmdPath "$SYSDIR\cmd.exe"
  StrCpy $PowerShellPath "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${if} ${isUpdated}
      Sleep 300
    ${endIf}

    !insertmacro FIND_TRIBENET_PROCESS $TribeNetProcessCheck
    ${if} $TribeNetProcessCheck == 0
      ${if} ${isUpdated}
        Sleep 1000
        Goto TribeNetStopProcess
      ${endIf}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK TribeNetStopProcess
      SetErrorLevel 2
      Quit

      TribeNetStopProcess:
      DetailPrint "$(appClosing)"
      nsExec::Exec `"$CmdPath" /C taskkill /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
      Sleep 300
      StrCpy $R1 0

      TribeNetProcessLoop:
        IntOp $R1 $R1 + 1
        !insertmacro FIND_TRIBENET_PROCESS $TribeNetProcessCheck
        ${if} $TribeNetProcessCheck == 0
          Sleep 1000
          nsExec::Exec `"$CmdPath" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
          !insertmacro FIND_TRIBENET_PROCESS $TribeNetProcessCheck
          ${if} $TribeNetProcessCheck == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto TribeNetNotRunning
          ${endIf}
        ${else}
          Goto TribeNetNotRunning
        ${endIf}

        ${if} $R1 > 1
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY TribeNetProcessLoop
          SetErrorLevel 2
          Quit
        ${else}
          Goto TribeNetProcessLoop
        ${endIf}

      TribeNetNotRunning:
    ${endIf}
  ${endIf}
!macroend
