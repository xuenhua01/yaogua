# Publish the web build to GitHub Pages.
#
#   .\tools\deploy_github.ps1 -TokenFile D:\Tools\_downloads\gh_token.txt
#
# What it does:
#   1. read a GitHub token from a file (keeps it out of the chat log)
#   2. create the repo if it does not exist
#   3. git init / commit / push
#   4. turn GitHub Pages on and wait until it is built
#   5. print the public URL
#
# The token needs repo scope (classic) or Contents+Pages+Administration
# read/write (fine-grained). Delete the token file afterwards.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 without a BOM as
# ANSI and would mangle any non-ASCII literal.

param(
    [string]$TokenFile = 'D:\Tools\_downloads\gh_token.txt',
    [string]$RepoName = 'yaogua',
    [string]$SiteDir = 'D:\AndroidProjects\YaoGuaWeb',
    [string]$Description = 'Xu Banxian - 64 hexagrams as 64 situations',
    [switch]$SkipPages
)

$ErrorActionPreference = 'Stop'

$api = 'https://api.github.com'
$git = 'D:\Tools\Git\cmd\git.exe'

if (-not (Test-Path $TokenFile)) {
    throw "Token file not found: $TokenFile"
}
$token = (Get-Content $TokenFile -Raw).Trim()
if (-not $token) { throw "Token file is empty: $TokenFile" }

$headers = @{
    'Authorization'        = "token $token"
    'User-Agent'           = 'xubanxian-deploy'
    'Accept'               = 'application/vnd.github+json'
}

function Invoke-GitHub {
    param([string]$Method, [string]$Path, $Body)
    $params = @{
        Method  = $Method
        Uri     = "$api$Path"
        Headers = $headers
        TimeoutSec = 60
    }
    if ($Body) {
        $params['Body']        = ($Body | ConvertTo-Json -Depth 6)
        $params['ContentType'] = 'application/json'
    }
    Invoke-RestMethod @params
}

# ---------- 1. who am I ----------
$me = Invoke-GitHub -Method GET -Path '/user'
$login = $me.login
Write-Host "Logged in as: $login"

# ---------- 2. create the repo if needed ----------
$repoPath = "/repos/$login/$RepoName"
$exists = $true
try { Invoke-GitHub -Method GET -Path $repoPath | Out-Null }
catch { $exists = $false }

if ($exists) {
    Write-Host "Repo exists: $login/$RepoName"
} else {
    Invoke-GitHub -Method POST -Path '/user/repos' -Body @{
        name        = $RepoName
        description = $Description
        private     = $false
        auto_init   = $false
    } | Out-Null
    Write-Host "Repo created: $login/$RepoName"
}

# ---------- 3. commit and push ----------
Push-Location $SiteDir
try {
    if (-not (Test-Path (Join-Path $SiteDir '.git'))) {
        & $git init -b main | Out-Null
    }
    # GitHub Pages: skip Jekyll so every file is served as-is
    $nojekyll = Join-Path $SiteDir '.nojekyll'
    if (-not (Test-Path $nojekyll)) { New-Item -ItemType File -Path $nojekyll | Out-Null }

    & $git add -A
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    & $git -c user.name='xubanxian' -c user.email='xubanxian@local' `
        commit -m "deploy $stamp" 2>&1 | Out-Null

    $remote = "https://github.com/$login/$RepoName.git"
    $pushUrl = "https://$login`:$token@github.com/$login/$RepoName.git"
    & $git remote remove origin 2>$null | Out-Null
    & $git remote add origin $remote
    Write-Host "Pushing..."
    & $git push -q -u $pushUrl main --force
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    Write-Host "Pushed to $remote"
}
finally {
    Pop-Location
}

if ($SkipPages) { exit 0 }

# ---------- 4. turn Pages on ----------
$pagesBody = @{ source = @{ branch = 'main'; path = '/' } }
$pagesState = $null
try {
    $pagesState = Invoke-GitHub -Method POST -Path "$repoPath/pages" -Body $pagesBody
    Write-Host "Pages enabled."
}
catch {
    try {
        $pagesState = Invoke-GitHub -Method PUT -Path "$repoPath/pages" -Body $pagesBody
        Write-Host "Pages already on, settings updated."
    }
    catch {
        Write-Host "Could not enable Pages automatically: $($_.Exception.Message)"
        Write-Host "Turn it on by hand: repo Settings -> Pages -> Source: main / root"
    }
}

# ---------- 5. wait for the first build ----------
$url = "https://$login.github.io/$RepoName/"
Write-Host ""
Write-Host "Public URL: $url"
Write-Host "Waiting for the first build (usually under a minute)..."

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 6
    try {
        $st = Invoke-GitHub -Method GET -Path "$repoPath/pages"
        if ($st.status -eq 'built') {
            Write-Host "Build finished. Open: $url"
            exit 0
        }
        if ($st.status -eq 'errored') {
            Write-Host "Build reported an error. Check the repo's Actions tab."
            exit 1
        }
        Write-Host "  status: $($st.status)"
    }
    catch {
        Write-Host "  waiting..."
    }
}

Write-Host "Still building after 3 minutes - it is probably fine, open the URL in a bit."
