Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logoPath = Join-Path (Split-Path -Parent $root) "resources\icon\icon-512.png"
$outPath = Join-Path (Split-Path -Parent $root) "resources\splash.bmp"
$logo = [System.Drawing.Image]::FromFile($logoPath)
$W = 520
$H = 300
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
# Background: vertical gradient #F8FAFD -> #DFE7F4 (BMP-safe, no alpha)
$bgTop = [System.Drawing.ColorTranslator]::FromHtml("#F8FAFD")
$bgBottom = [System.Drawing.ColorTranslator]::FromHtml("#DFE7F4")
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point(0, $H)),
  $bgTop, $bgBottom)
$g.FillRectangle($gradBrush, 0, 0, $W, $H)
$gradBrush.Dispose()
$inkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0F172A"))
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#5B6B85"))
$lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#DBE1EC"))
$accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#4F46E5"))
$whiteBrush = [System.Drawing.Brushes]::White
# Top highlight hairline + bottom accent bar
$g.FillRectangle($whiteBrush, 0, 0, $W, 2)
$g.FillRectangle($lineBrush, 0, 289, $W, 1)
$g.FillRectangle($accentBrush, 0, 290, $W, 10)
# Icon plate: centered white 160x160 with hairline border
$plateX = [int](($W - 160) / 2)
$g.FillRectangle($whiteBrush, $plateX, 22, 160, 160)
$pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#DBE1EC"), 1)
$g.DrawRectangle($pen, $plateX, 22, 160, 160)
$pen.Dispose()
$s = 112
$g.DrawImage($logo, [int](($W - $s) / 2), 38, $s, $s)
$f = New-Object System.Drawing.Font("Segoe UI", 19, [System.Drawing.FontStyle]::Bold)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
$g.DrawString("أرشيف — نظام الأرشفة الإلكتروني", $f, $inkBrush, (New-Object System.Drawing.RectangleF(0, 192, $W, 34)), $sf)
# Divider between title and status
$g.FillRectangle($lineBrush, 200, 228, 120, 1)
$f2 = New-Object System.Drawing.Font("Segoe UI", 12)
$g.DrawString("جاري تجهيز البرنامج، يرجى الانتظار...", $f2, $mutedBrush, (New-Object System.Drawing.RectangleF(0, 236, $W, 28)), $sf)
$inkBrush.Dispose()
$mutedBrush.Dispose()
$lineBrush.Dispose()
$accentBrush.Dispose()
$g.Dispose()
$logo.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Dispose()
(Get-Item $outPath).Length
