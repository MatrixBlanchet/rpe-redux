param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$Subject = 'CN=RPE Redux Development',
    [string]$Thumbprint,
    [string]$TimestampServer,
    [string]$SignCodePath,
    [switch]$RequireExistingCertificate,
    [switch]$TrustForCurrentUser
)

$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Security
$artifact = (Resolve-Path -LiteralPath $Path).Path
$normalizedThumbprint = ($Thumbprint -replace '\s', '').ToUpperInvariant()
$certificates = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.HasPrivateKey }
if ($normalizedThumbprint) {
    $certificate = $certificates |
        Where-Object { ($_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $normalizedThumbprint } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1
} else {
    $certificate = $certificates |
        Where-Object { $_.Subject -eq $Subject } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1
}

if (!$certificate -and ($RequireExistingCertificate -or $SignCodePath)) {
    $selector = if ($normalizedThumbprint) { "thumbprint $Thumbprint" } else { "subject $Subject" }
    throw "No code-signing certificate with $selector and a private key was found in Cert:\CurrentUser\My."
}

if (!$certificate -and !$SignCodePath) {
    $certificate = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -CertStoreLocation Cert:\CurrentUser\My `
        -HashAlgorithm SHA256 `
        -KeyAlgorithm RSA `
        -KeyLength 3072 `
        -NotAfter (Get-Date).AddYears(3)
}

if ($TrustForCurrentUser) {
    $temporaryCertificate = Join-Path ([IO.Path]::GetTempPath()) 'rpe-redux-development.cer'
    Export-Certificate -Cert $certificate -FilePath $temporaryCertificate -Type CERT | Out-Null
    try {
        Import-Certificate -FilePath $temporaryCertificate -CertStoreLocation Cert:\CurrentUser\TrustedPublisher | Out-Null
    } finally {
        Remove-Item -LiteralPath $temporaryCertificate -Force -ErrorAction SilentlyContinue
    }
}

$signCode = $null
if ($SignCodePath) {
    $signCode = (Resolve-Path -LiteralPath $SignCodePath).Path
    $signArguments = @('-n', $(if ($normalizedThumbprint) { $Thumbprint } else { $Subject }))
    if ($TimestampServer) {
        $signArguments += @('-t', $TimestampServer)
    }
    $signArguments += $artifact
    & $signCode @signArguments
    if ($LASTEXITCODE -ne 0) {
        throw "SignCode failed with exit code $LASTEXITCODE."
    }
    $signature = Get-AuthenticodeSignature -FilePath $artifact
} else {
    $signArguments = @{
        FilePath     = $artifact
        Certificate  = $certificate
        HashAlgorithm = 'SHA256'
    }
    if ($TimestampServer) {
        $signArguments.TimestampServer = $TimestampServer
    }
    $signature = Set-AuthenticodeSignature @signArguments
}
$signedThumbprint = if ($signature.SignerCertificate) {
    ($signature.SignerCertificate.Thumbprint -replace '\s', '').ToUpperInvariant()
}
$expectedThumbprint = ($certificate.Thumbprint -replace '\s', '').ToUpperInvariant()
if (!$signature.SignerCertificate -or $signedThumbprint -ne $expectedThumbprint) {
    throw "Authenticode signing failed: the output is not signed by the selected certificate."
}
if ($signature.Status -notin @('Valid', 'NotTrusted', 'UnknownError')) {
    throw "Authenticode signing failed: $($signature.Status) $($signature.StatusMessage)"
}
if ($signature.Status -ne 'Valid') {
    Write-Warning "The Authenticode signature is present, but this Windows user does not trust the certificate yet: $($signature.Status)"
}

Write-Output "Signed $artifact with $($certificate.Subject)."
if ($TrustForCurrentUser) {
    Write-Output 'The certificate was trusted for the current Windows user only.'
}
