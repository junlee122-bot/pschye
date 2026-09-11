param(
  [string]$SourceDirectory = "$env:USERPROFILE\Desktop",
  [string]$ManifestPath = "$PSScriptRoot\hitem3d-production-manifest.json",
  [string]$OutputDirectory = "$PSScriptRoot\..\..\artifacts\3d\hitem3d-inputs",
  [int]$OutputWidth = 768,
  [int]$OutputHeight = 1152,
  [int]$JpegQuality = 92
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Save-CroppedReference {
  param(
    [System.Drawing.Bitmap]$Source,
    [int[]]$Crop,
    [string]$Destination
  )

  $cropRectangle = [System.Drawing.Rectangle]::new($Crop[0], $Crop[1], $Crop[2], $Crop[3])
  $cropped = $Source.Clone($cropRectangle, $Source.PixelFormat)
  $canvas = [System.Drawing.Bitmap]::new($OutputWidth, $OutputHeight)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::FromArgb(246, 240, 226))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $scale = [Math]::Min($OutputWidth / $cropped.Width, $OutputHeight / $cropped.Height)
  $drawWidth = [int][Math]::Round($cropped.Width * $scale)
  $drawHeight = [int][Math]::Round($cropped.Height * $scale)
  $drawX = [int](($OutputWidth - $drawWidth) / 2)
  $drawY = [int](($OutputHeight - $drawHeight) / 2)
  $graphics.DrawImage($cropped, $drawX, $drawY, $drawWidth, $drawHeight)

  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1
  $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality,
    [long]$JpegQuality
  )
  $canvas.Save($Destination, $jpegCodec, $parameters)

  $parameters.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
  $cropped.Dispose()
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$prepared = @()
foreach ($character in $manifest.characters) {
  $sourcePath = Join-Path $SourceDirectory $character.sourceFile
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Reference sheet not found: $sourcePath"
  }

  $characterDirectory = Join-Path $resolvedOutput $character.characterId
  New-Item -ItemType Directory -Path $characterDirectory -Force | Out-Null
  $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $frontPath = Join-Path $characterDirectory "front.jpg"
    Save-CroppedReference -Source $bitmap -Crop $character.frontCrop -Destination $frontPath
    $views = [ordered]@{ front = $frontPath }

    if ($character.rightCrop) {
      $rightPath = Join-Path $characterDirectory "right.jpg"
      Save-CroppedReference -Source $bitmap -Crop $character.rightCrop -Destination $rightPath
      $views.right = $rightPath
    }

    $prepared += [ordered]@{
      characterId = $character.characterId
      characterName = $character.characterName
      source = $sourcePath
      views = $views
    }
  }
  finally {
    $bitmap.Dispose()
  }
}

$reportPath = Join-Path $resolvedOutput "prepared-inputs.json"
$prepared | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host "Prepared $($prepared.Count) Hi3D character input sets at $resolvedOutput"
