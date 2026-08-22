param(
    [Parameter(Mandatory = $true)][string]$OutPath,
    [int]$Dpi = 300,
    [int]$ColorMode = 2
)

# Scans one page from the first WIA scanner physically connected to this
# machine (USB / network / MFP). Uses the built-in Windows WIA COM API —
# no third-party drivers or licenses required.
# WIA DeviceType: 0=Unspecified, 1=Scanner, 2=Camera, 3=Video, 4=Default.
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
    $scanner = $deviceManager.DeviceInfos | Where-Object { $_.Type -eq 1 } | Select-Object -First 1
    if (-not $scanner) {
        Write-Host "NO_SCANNER"
        exit 2
    }

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
