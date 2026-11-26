# 호롱 HORONG — Windows 로컬 세팅 + GitHub 저장소 생성
# 사용법: 이 폴더에서 PowerShell을 열고  ->  powershell -ExecutionPolicy Bypass -File .\setup.ps1
# 또는 setup.bat 을 더블클릭하세요.

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
$RepoName = "horong"

function Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Magenta }

# 1) Node.js
Step "Node.js 확인"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js가 없어요. winget으로 LTS를 설치합니다..." -ForegroundColor Yellow
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  Write-Host "설치가 끝나면 PowerShell을 새로 열고 setup.ps1을 다시 실행해 주세요." -ForegroundColor Yellow
  exit 0
}
node -v

# 2) 의존성 설치
Step "패키지 설치 (npm install)"
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Write-Host "npm install 실패 — 위 오류를 확인해 주세요." -ForegroundColor Red; exit 1 }

# 3) Git
Step "Git 확인"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
  Write-Host "Git 설치 후 PowerShell을 새로 열고 다시 실행해 주세요." -ForegroundColor Yellow
  exit 0
}
if (-not (Test-Path ".git")) {
  git init -b main | Out-Null
  git add -A
  git commit -m "feat: HORONG MVP" | Out-Null
}
git log --oneline -1

# 4) GitHub 저장소 생성 + push (GitHub CLI)
Step "GitHub 저장소 만들기"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "GitHub CLI를 설치합니다..." -ForegroundColor Yellow
  winget install -e --id GitHub.cli --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "브라우저가 열리면 GitHub에 로그인해 주세요." -ForegroundColor Yellow
  gh auth login --web --git-protocol https
}
# 첫 커밋 작성자를 내 GitHub 계정 정보로 바꾸기
$ghLogin = gh api user --jq .login 2>$null
$ghId = gh api user --jq .id 2>$null
if ($ghLogin -and -not (git config user.email)) {
  git config user.name $ghLogin
  git config user.email "$ghId+$ghLogin@users.noreply.github.com"
}
if ((git rev-list --count HEAD) -eq "1" -and -not (git remote)) { git commit --amend --reset-author --no-edit | Out-Null }
$hasRemote = git remote 2>$null | Select-String -Quiet "origin"
if (-not $hasRemote) {
  # 비공개 저장소로 생성. .env.local 은 .gitignore 로 제외되어 올라가지 않아요.
  gh repo create $RepoName --private --source . --remote origin --push --description "호롱 — 같은 문장에 멈춘 사람을 비추는 불 (Social reading MVP)"
  if ($LASTEXITCODE -ne 0) { Write-Host "저장소를 만들지 못했어요. 같은 이름의 저장소가 이미 있다면 setup.ps1의 `$RepoName을 바꿔 주세요." -ForegroundColor Red }
} else {
  git push -u origin main
}
gh repo view --web

# 5) 실행
Step "개발 서버 실행 — http://localhost:3000"
if (Get-Command code -ErrorAction SilentlyContinue) { code . }
npm run dev
