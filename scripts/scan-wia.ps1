param(
    [string]$OutPath = "",
    [int]$Dpi = 300,
    [int]$ColorMode = 2,
    [int]$DeviceIndex = 1,
    [switch]$ListOnly
)

# Multi-scan WIA driver for the EDMS scanner window. Uses the built-in Windows
# WIA COM API — no third-party drivers or licenses required.
# WIA DeviceType: 0=Unspecified, 1=Scanner, 2=Camera, 3=Video, 4=Default.
#
# Modes:
#   -ListOnly            → prints one `DEVICE|<index>|<DeviceID>|<Name>` line per
#                          connected scanner (Type 1) and exits 0 (2 = none).
#   (default scan mode)  → scans one page from the DeviceIndex-th scanner
#                          (1-based, default 1 = first scanner, backward
#                          compatible) into -OutPath as JPEG.
# Exit codes: 0 = OK, 1 = scan failed, 2 = no scanner found, 3 = WIA unavailable

$ErrorActionPreference = "Stop"

$deviceManager = $null
$scanner = $null
$device = $null
$item = $null

try {
    try {
        $deviceManager = New-Object -ComObject WIA.DeviceManager
    } catch {
        Write-Host "WIA_UNAVAILABLE: $($_.Exception.Message)"
        exit 3
    }

    # Type 1 = Scanner (printers/MFP expose a scanner item as Type 1).
    $scanners = @($deviceManager.DeviceInfos | Where-Object { $_.Type -eq 1 })
    if ($scanners.Count -eq 0) {
        Write-Host "NO_SCANNER"
        exit 2
    }

    if ($ListOnly) {
        for ($i = 0; $i -lt $scanners.Count; $i++) {
            $info = $scanners[$i]
            $name = ""
            try { $name = $info.Properties("Name").Value } catch { }
            if ([string]::IsNullOrWhiteSpace($name)) { $name = "Scanner $($i + 1)" }
            # Pipe-delimited: index is stable for -DeviceIndex selection.
            $safe = $name -replace '\|', '/'
            Write-Host ("DEVICE|{0}|{1}|{2}" -f ($i + 1), $info.DeviceID, $safe)
        }
        Write-Host "OK"
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($OutPath)) {
        Write-Host "SCAN_FAILED: -OutPath is required in scan mode"
        exit 1
    }
    if ($DeviceIndex -lt 1 -or $DeviceIndex -gt $scanners.Count) {
        Write-Host ("SCAN_FAILED: device index {0} out of range (1..{1})" -f $DeviceIndex, $scanners.Count)
        exit 1
    }
    $scanner = $scanners[$DeviceIndex - 1]

    $device = $scanner.Connect()
    $item = $device.Items(1)

    $item.Properties("6146").Value = $Dpi   # HorizontalResolution
    $item.Properties("6147").Value = $Dpi   # VerticalResolution
    $item.Properties("6148").Value = $ColorMode  # 0=B/W, 1=Grayscale, 2=Color

    # Transfer as JPEG
    $image = $item.Transfer("{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}")
    $image.SaveFile($OutPath)

    if (-not (Test-Path -LiteralPath $OutPath)) {
        Write-Host "SCAN_FAILED: output file was not created"
        exit 1
    }

    Write-Host "OK"
} catch {
    Write-Host "SCAN_FAILED: $($_.Exception.Message)"
    exit 1
} finally {
    # Always release COM objects, even on failure — avoids leaked handles.
    foreach ($obj in @($item, $device, $scanner, $deviceManager)) {
        if ($null -ne $obj) {
            try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) | Out-Null } catch { }
        }
    }
}
