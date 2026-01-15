$ErrorActionPreference = "Stop"

function Test-Secret {
    param (
        [string]$Description,
        [scriptblock]$Check
    )
    Write-Host "Running check: $Description..." -NoNewline
    try {
        & $Check
        Write-Host " [PASS]" -ForegroundColor Green
    }
    catch {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting Security Audit..." -ForegroundColor Cyan

# Regex for Google API Key: AIza followed by 34 characters (base64-ish)
# We use a slightly looser check: AIza followed by at least 30 valid chars.
$KeyRegex = "AIza[0-9A-Za-z\-_]{30,}"

# Check 1: Grep for AIza in tracked files
Test-Secret "Grep for real AIza keys in tracked files" {
    # -E for extended regex
    # -I to ignore binaries
    # -n for line numbers
    # Exclude strict paths
    $result = git grep -n -I -E "$KeyRegex" -- :^scripts/secret-audit.ps1 :^scripts/pre-commit 2>$null
    if ($result) {
        throw "Found potential real Google API Key in tracked files:`n$result"
    }
}

# Check 2: Grep for GEMINI_API_KEY real values
Test-Secret "Grep for real GEMINI_API_KEY assignment" {
    # Look for GEMINI_API_KEY=AIza...
    # We can rely on the regex check above for the key value, but we also want to catch
    # assignments that might have weird spacing or specific variable names.
    # This check is supplementary.
    $result = git grep "GEMINI_API_KEY" -- :^scripts/secret-audit.ps1 :^scripts/pre-commit | Select-String -NotMatch "YOUR_GEMINI_API_KEY_HERE|process\.env\.GEMINI_API_KEY|config\.GEMINI_API_KEY|missingVars|Critical variables"
    
    if ($result) {
        $lines = $result | ForEach-Object { $_.ToString() }
        foreach ($line in $lines) {
            # If it looks like an assignment to a real key (AIza...)
            if ($line -match "AIza") {
                throw "Found potential real GEMINI_API_KEY assignment:`n$line"
            }
        }
    }
}

# Check 3: Check if dev.db is tracked
Test-Secret "Check if backend/prisma/dev.db is tracked" {
    $result = git ls-files backend/prisma/dev.db
    if ($result) {
        throw "backend/prisma/dev.db is still tracked!"
    }
}

# Check 4: Recursive working tree scan for AIza
Test-Secret "Recursive working tree scan for AIza" {
    $files = Get-ChildItem -Recurse -File -Exclude ".git", "*.log" -ErrorAction SilentlyContinue | Where-Object { 
        $_.FullName -notmatch "\\node_modules\\" -and 
        $_.FullName -notmatch "\\.git\\" -and 
        $_.FullName -notmatch "\\dist\\" -and 
        $_.FullName -notmatch "\\build\\"
    }

    foreach ($file in $files) {
        # Skip this script and pre-commit
        if ($file.FullName -match "secret-audit.ps1") { continue }
        if ($file.FullName -match "pre-commit") { continue }
        
        try {
            $match = Select-String -Path $file.FullName -Pattern "$KeyRegex" -Quiet
            if ($match) {
                throw "Found potential real Google API Key in $($file.FullName)"
            }
        }
        catch {
            # Ignore read errors
        }
    }
}

# Check 5: Git History Scan (Strict)
Test-Secret "Git History Scan for AIza pattern" {
    # We search for the pattern.
    # Note: git log -G uses regex.
    $result = git log -p -G "$KeyRegex" --all
    if ($result) {
        throw "Found potential real Google API Key in git history! You must rewrite history."
    }
}

Write-Host "`nALL CHECKS PASSED. REPOSITORY IS SECURE." -ForegroundColor Green
exit 0
