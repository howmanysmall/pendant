param (
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Pattern
)

if (-not $Pattern) {
    Write-Host "Usage: .\tsc.ps1 <pattern for rg>"
    exit 1
}

bun x tsc --noEmit -p tsconfig.json | rg @Pattern
