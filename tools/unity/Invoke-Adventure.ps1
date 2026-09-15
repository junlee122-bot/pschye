[CmdletBinding()]
param(
    [ValidateSet('Probe', 'Open', 'Verify', 'EditMode', 'PlayMode', 'Build')]
    [string]$Action = 'Probe',
    [string]$UnityEditorPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$requiredVersion = '6000.0.75f1'
$repositoryPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$projectPath = Join-Path $repositoryPath 'unity/PsycheAdventure'
$editorProcess = $null
$editorExitCode = $null
$runDirectory = $null
$logPath = $null
$testResultsPath = $null
$testSummary = $null
$verification = $null
$probe = $null

function Resolve-Editor {
    param([string]$ExplicitPath)
    $requested = $ExplicitPath
    $source = 'parameter'
    if ([string]::IsNullOrWhiteSpace($requested)) {
        $requested = $env:UNITY_EDITOR_PATH
        $source = 'UNITY_EDITOR_PATH'
    }
    if (-not [string]::IsNullOrWhiteSpace($requested)) {
        return [pscustomobject]@{
            Path = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($requested))
            Source = $source
            Candidates = @()
        }
    }

    $candidates = New-Object 'System.Collections.Generic.List[string]'
    $programDirectories = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    foreach ($directory in $programDirectories) {
        $hubEditors = Join-Path $directory 'Unity/Hub/Editor'
        if (Test-Path -LiteralPath $hubEditors -PathType Container) {
            # Only inspect Hub's immediate version directories, never the whole disk.
            foreach ($versionDirectory in Get-ChildItem -LiteralPath $hubEditors -Directory) {
                $candidate = Join-Path $versionDirectory.FullName 'Editor/Unity.exe'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidates.Add($candidate) }
            }
        }
        $standalone = Join-Path $directory 'Unity/Editor/Unity.exe'
        if (Test-Path -LiteralPath $standalone -PathType Leaf) { $candidates.Add($standalone) }
    }
    $ordered = @($candidates | Sort-Object -Unique -Descending)
    $preferred = @($ordered | Where-Object { $_ -match [regex]::Escape($requiredVersion) })
    $selected = $null
    if ($preferred.Count -gt 0) { $selected = $preferred[0] }
    elseif ($ordered.Count -gt 0) { $selected = $ordered[0] }
    return [pscustomobject]@{ Path = $selected; Source = 'default-install-locations'; Candidates = $ordered }
}

function ConvertTo-NativeArgument {
    param([AllowEmptyString()][string]$Value)
    # Start-Process joins ArgumentList into one command line on Windows. Quote
    # every argument using the native backslash-before-quote/trailing-slash rules.
    $escaped = [regex]::Replace($Value, '(\\*)("|$)', {
        param($match)
        $slashes = $match.Groups[1].Value
        if ($match.Groups[2].Value -eq '"') { return $slashes + $slashes + '\"' }
        return $slashes + $slashes
    })
    return '"' + $escaped + '"'
}

function Read-TestResults {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Unity did not produce a test XML file: $Path"
    }
    $settings = New-Object System.Xml.XmlReaderSettings
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create($Path, $settings)
    try {
        $document = New-Object System.Xml.XmlDocument
        $document.XmlResolver = $null
        $document.Load($reader)
    }
    finally { $reader.Dispose() }
    $root = $document.DocumentElement
    [long]$passed = 0
    [long]$failed = 0
    if ($null -eq $root -or $root.Name -ne 'test-run' -or
        -not [long]::TryParse($root.GetAttribute('passed'), [ref]$passed) -or
        -not [long]::TryParse($root.GetAttribute('failed'), [ref]$failed)) {
        throw "Test XML has no valid NUnit test-run counts: $Path"
    }
    $passedCases = $document.SelectNodes('//test-case[@result="Passed"]').Count
    $failedCases = $document.SelectNodes('//test-case[@result="Failed"]').Count
    $result = $root.GetAttribute('result')
    return [pscustomobject]@{
        result = $result
        passed = $passed
        failed = $failed
        passedCases = $passedCases
        failedCases = $failedCases
        success = ($result -eq 'Passed' -and $passed -gt 0 -and $failed -eq 0 -and
            $passedCases -eq $passed -and $failedCases -eq 0)
    }
}

try {
    $editor = Resolve-Editor $UnityEditorPath
    $exists = -not [string]::IsNullOrWhiteSpace($editor.Path) -and
        (Test-Path -LiteralPath $editor.Path -PathType Leaf)
    $editorVersion = $null
    $rawVersion = $null
    if ($exists) {
        $info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($editor.Path)
        $rawVersion = $info.ProductVersion
        $versionMatch = [regex]::Match([string]$rawVersion, '\d+\.\d+\.\d+[abfp]\d+')
        if ($versionMatch.Success) { $editorVersion = $versionMatch.Value }
    }
    $probe = [ordered]@{
        action = $Action
        repositoryPath = $repositoryPath
        projectPath = $projectPath
        projectExists = (Test-Path -LiteralPath $projectPath -PathType Container)
        requiredEditorVersion = $requiredVersion
        editorPath = $editor.Path
        editorExists = [bool]$exists
        editorVersion = $editorVersion
        rawProductVersion = $rawVersion
        matchesRequiredVersion = ($exists -and $editorVersion -eq $requiredVersion)
        discoverySource = $editor.Source
        discoveredCandidates = @($editor.Candidates)
    }
    if ($Action -eq 'Probe') {
        $probe | ConvertTo-Json -Depth 6
        exit 0
    }
    if (-not $exists) {
        throw 'Unity Editor was not found. Install/activate it separately, then supply -UnityEditorPath or UNITY_EDITOR_PATH. This tool does not install software or sign in.'
    }
    if ([System.IO.Path]::GetFileName($editor.Path) -ine 'Unity.exe') {
        throw 'UnityEditorPath must point to the Unity.exe Editor executable.'
    }
    if (-not $probe.projectExists) { throw "Adventure project was not found: $projectPath" }
    if ($editorVersion -and $editorVersion -ne $requiredVersion) {
        throw "Expected Unity $requiredVersion, found $editorVersion. Refusing to open or upgrade the project with a different Editor."
    }

    $runName = '{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Action, ([guid]::NewGuid().ToString('N').Substring(0, 8))
    $runDirectory = Join-Path (Join-Path $projectPath 'TestResults') $runName
    [System.IO.Directory]::CreateDirectory($runDirectory) | Out-Null
    $logPath = Join-Path $runDirectory 'Editor.log'
    $arguments = @('-projectPath', $projectPath, '-logFile', $logPath)
    if ($Action -ne 'Open') { $arguments += '-batchmode' }
    switch ($Action) {
        'Verify' { $arguments += @('-executeMethod', 'Raonjena.Adventure.Editor.FoundationProject.VerifyProject', '-foundationRunId', $runName, '-quit') }
        'Build' { $arguments += @('-executeMethod', 'Raonjena.Adventure.Editor.FoundationProject.BuildWindows', '-foundationRunId', $runName, '-quit') }
        { $_ -eq 'EditMode' -or $_ -eq 'PlayMode' } {
            $testResultsPath = Join-Path $runDirectory ('{0}.xml' -f $Action)
            # Unity's test runner exits itself. -quit can terminate before tests finish.
            $arguments += @('-runTests', '-testPlatform', $Action.ToLowerInvariant(), '-testResults', $testResultsPath)
        }
    }
    $argumentLine = ($arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' '
    if ($Action -eq 'Open') {
        # Open is the explicit interactive action; all verification actions stay hidden.
        $editorProcess = Start-Process -FilePath $editor.Path -ArgumentList $argumentLine -WorkingDirectory $projectPath -WindowStyle Normal -PassThru
        [ordered]@{ status = 'launch-requested'; probe = $probe; processId = $editorProcess.Id; logPath = $logPath } | ConvertTo-Json -Depth 7
        exit 0
    }
    $editorProcess = Start-Process -FilePath $editor.Path -ArgumentList $argumentLine -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru
    # Short waits leave PowerShell able to service Ctrl+C and enter finally.
    while (-not $editorProcess.WaitForExit(500)) { }
    $editorProcess.WaitForExit()
    $editorExitCode = $editorProcess.ExitCode
    if ($testResultsPath) { $testSummary = Read-TestResults $testResultsPath }
    if ($editorExitCode -ne 0) { throw "Unity exited with code $editorExitCode. See $logPath" }
    if ($testResultsPath -and -not $testSummary.success) {
        throw "Test XML does not show a non-empty passing run with zero failures. See $testResultsPath"
    }
    if ($Action -eq 'Verify' -or $Action -eq 'Build') {
        # A zero exit code alone does not prove executeMethod reached completion.
        # Match this invocation's nonce so an old successful report cannot pass.
        $projectReportPath = Join-Path $projectPath 'TestResults/project-verification.json'
        $projectReport = Get-Content -LiteralPath $projectReportPath -Raw | ConvertFrom-Json
        if ($projectReport.runId -cne $runName -or
            $projectReport.editorVersion -cne $requiredVersion -or
            $projectReport.scene -cne 'Assets/Adventure/Scenes/RaonFoundation.unity' -or
            $projectReport.compiledAndSceneOpened -isnot [bool] -or
            $projectReport.compiledAndSceneOpened -ne $true) {
            throw "Project verification report does not confirm this invocation: $projectReportPath"
        }
        $preservedProjectReport = Join-Path $runDirectory 'project-verification.json'
        Copy-Item -LiteralPath $projectReportPath -Destination $preservedProjectReport
        $verification = [ordered]@{ runId = $runName; projectReportPath = $preservedProjectReport }
        if ($Action -eq 'Build') {
            $buildReportPath = Join-Path $projectPath 'TestResults/build-verification.json'
            $buildReport = Get-Content -LiteralPath $buildReportPath -Raw | ConvertFrom-Json
            $expectedOutput = 'Builds/RaonFoundation/RaonFoundation.exe'
            $buildOutputPath = Join-Path $projectPath $expectedOutput
            if ($buildReport.runId -cne $runName -or
                $buildReport.editorVersion -cne $requiredVersion -or
                $buildReport.result -cne 'Succeeded' -or
                $buildReport.outputPath -cne $expectedOutput -or
                -not (Test-Path -LiteralPath $buildOutputPath -PathType Leaf)) {
                throw "Build verification report or executable does not confirm this invocation: $buildReportPath"
            }
            $preservedBuildReport = Join-Path $runDirectory 'build-verification.json'
            Copy-Item -LiteralPath $buildReportPath -Destination $preservedBuildReport
            $verification.buildReportPath = $preservedBuildReport
            $verification.buildOutputPath = $buildOutputPath
        }
    }
    [ordered]@{
        status = 'passed'
        action = $Action
        probe = $probe
        editorExitCode = $editorExitCode
        logPath = $logPath
        testResultsPath = $testResultsPath
        tests = $testSummary
        verification = $verification
        scope = 'Editor command result; not a manual gameplay or visual quality approval.'
    } | ConvertTo-Json -Depth 7
}
catch {
    [ordered]@{
        status = 'failed'
        action = $Action
        message = $_.Exception.Message
        probe = $probe
        editorExitCode = $editorExitCode
        logPath = $logPath
        testResultsPath = $testResultsPath
        tests = $testSummary
        verification = $verification
    } | ConvertTo-Json -Depth 7
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
finally {
    if ($null -ne $editorProcess) {
        # Never enumerate or terminate unrelated Editors, servers or system processes.
        if ($Action -ne 'Open') {
            try { if (-not $editorProcess.HasExited) { $editorProcess.Kill(); $editorProcess.WaitForExit(5000) | Out-Null } }
            catch { [Console]::Error.WriteLine('Could not stop this invocation''s Editor process: ' + $_.Exception.Message) }
        }
        $editorProcess.Dispose()
    }
}
