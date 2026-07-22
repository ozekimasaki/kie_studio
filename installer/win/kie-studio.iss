; =============================================================================
; KIE STUDIO - Inno Setup installer / uninstaller (Windows, per-user, x64)
; -----------------------------------------------------------------------------
; Electrobun 純正 Setup.exe は「プログラム追加/削除 (ARP)」へ自動登録せず、
; アンインストーラー体験が不完全なため、Inno Setup で正式インストーラー化
; する。インストール先は Electrobun 既定 (%LocalAppData%\ai.kie.studio\<ch>\app)
; と完全一致させ、自動アップデート (Updater) の期待パスを維持する。
;
; バージョン/チャネルは ISCC の /D で注入する（build-win-installer.mjs 経由）。
;   iscc /DAppVersion=0.1.0 /DAppChannel=canary kie-studio.iss
; =============================================================================

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef AppChannel
  #define AppChannel "canary"
#endif

#define AppName        "KIE STUDIO"
#define AppId          "ai.kie.studio"
#define AppPublisher   "KIE STUDIO"
#define AppURL         "https://kie.ai"
#define LauncherExe    "bin\launcher.exe"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion} ({#AppChannel})
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
; Electrobun と同一パス = 自動アップデート互換の要。per-user で管理者権限不要。
DefaultDirName={localappdata}\ai.kie.studio\{#AppChannel}\app
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\release
OutputBaseFilename={#AppChannel}-win-x64-KIESTUDIO-Setup
SetupIconFile=..\..\assets\icon.ico
UninstallDisplayIcon={app}\app.ico
UninstallDisplayName={#AppName} ({#AppChannel})
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; インストール/アンインストール時にロック中の launcher/bun を終了させる。
CloseApplications=yes
CloseApplicationsFilter=launcher.exe,bun.exe
RestartApplications=no
ChangesEnvironment=no

[Languages]
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "デスクトップにショートカットを作成する"; GroupDescription: "追加のアイコン:"; Flags: checkedonce

[Files]
; ショートカット / ARP 表示用のアイコンを同梱（launcher.exe にはアイコンが無いため）。
Source: "..\..\assets\icon.ico"; DestDir: "{app}"; DestName: "app.ico"; Flags: ignoreversion
; アプリ本体ツリー（staging/ は build-win-installer.mjs が tar.zst から展開して用意）。
Source: "staging\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; スタートメニュー（Electrobun 純正と同じく Programs 直下に配置し上書き/削除を確実にする）。
Name: "{userprograms}\{#AppName}"; Filename: "{app}\{#LauncherExe}"; WorkingDir: "{app}\bin"; IconFilename: "{app}\app.ico"
; デスクトップ（タスクで選択時のみ）。
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#LauncherExe}"; WorkingDir: "{app}\bin"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#LauncherExe}"; WorkingDir: "{app}\bin"; Description: "{#AppName} を起動する"; Flags: nowait postinstall skipifsilent runascurrentuser

; インストール前に旧ツリー/残骸を掃除し、常に pristine な配置にする
; （自動アップデートで差し替わったファイルや Electrobun 純正の uninstall.reg を回収）。
[InstallDelete]
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\lib"
Type: filesandordirs; Name: "{app}\Resources"
Type: files; Name: "{app}\Info.plist"
Type: files; Name: "{app}\KIE STUDIO_uninstall.reg"
Type: files; Name: "{userprograms}\{#AppName}.lnk"

; アンインストール時、Inno の追跡外ファイル（自動アップデートで増えたもの等）も
; 含めてサブディレクトリごと削除し、{app} を空にして自己削除後に回収させる。
; （unins000.exe は {app} 直下にあるため bin/lib/Resources の削除は安全。）
[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\lib"
Type: filesandordirs; Name: "{app}\Resources"
Type: files; Name: "{app}\Info.plist"
Type: files; Name: "{app}\app.ico"

; [UninstallDelete] + 追跡ファイル削除で {app} は空になるが、Inno は空のインストール先
; ディレクトリを回収しない。unins000.exe の自己削除を待ってから {app} のみ削除する。
; 親 dir (canary/) にはユーザーDB (studio.db) があるため絶対に触らない（破滅的破壊を回避）。
[UninstallRun]
Filename: "{cmd}"; Parameters: "/c ping 127.0.0.1 -n 4 > nul & rd /s /q ""{app}"""; Flags: nowait runhidden runascurrentuser; RunOnceId: "KieStudioCleanAppDir"
