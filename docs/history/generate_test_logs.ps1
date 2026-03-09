
$logDir = "C:\AntigravityWorkspace\happytool_electron\haappytool_electron\test_logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir }

$lineCount = 95000 # 약 10MB를 맞추기 위한 라인 수 (한 줄당 약 100~110바이트 가정)

# 1. 형식: [1234.000000000]  333.999 I/TAG (P 1111, T 1116): file.cpp: functionName(110) > log contents
Write-Host "Generating format 1..."
$file1 = Join-Path $logDir "test_log_format_1.txt"
$sb = New-Object System.Text.StringBuilder
for ($i = 0; $i -lt $lineCount; $i++) {
    $ts1 = 1234.000000000 + ($i * 0.001)
    $ts2 = 333.999 + ($i * 0.001)
    $p_id = 1111 + ($i % 5)
    $tid = 1116 + ($i % 10)
    $line = "[{0:F9}]  {1:F3} I/TAG (P {2}, T {3}): file.cpp: functionName({4}) > log contents line {5}`r`n" -f $ts1, $ts2, $p_id, $tid, ($i % 500), $i
    [void]$sb.Append($line)
    if ($i % 5000 -eq 0) { [System.IO.File]::AppendAllText($file1, $sb.ToString()); $sb.Clear() }
}
[System.IO.File]::AppendAllText($file1, $sb.ToString())

# 2. 형식: 333.999 I/TAG (P 1111, T 1116): file.cpp: functionName(110) > log contents
Write-Host "Generating format 2..."
$file2 = Join-Path $logDir "test_log_format_2.txt"
$sb = New-Object System.Text.StringBuilder
for ($i = 0; $i -lt $lineCount; $i++) {
    $ts2 = 333.999 + ($i * 0.001)
    $p_id = 2222 + ($i % 5)
    $tid = 2226 + ($i % 10)
    $line = "{0:F3} I/TAG (P {1}, T {2}): file.cpp: functionName({3}) > log contents line {4}`r`n" -f $ts2, $p_id, $tid, ($i % 500), $i
    [void]$sb.Append($line)
    if ($i % 5000 -eq 0) { [System.IO.File]::AppendAllText($file2, $sb.ToString()); $sb.Clear() }
}
[System.IO.File]::AppendAllText($file2, $sb.ToString())

# 3. 형식:     bluetoothapp 3333.8888777766 E/TAG (P  123, T 199): filename.cs: functionName(666) > log contents
Write-Host "Generating format 3..."
$file3 = Join-Path $logDir "test_log_format_3.txt"
$sb = New-Object System.Text.StringBuilder
for ($i = 0; $i -lt $lineCount; $i++) {
    $ts3 = 3333.8888777766 + ($i * 0.000001)
    $p_id = 123 + ($i % 3)
    $tid = 199 + ($i % 7)
    $line = "    bluetoothapp {0:F10} E/TAG (P  {1}, T {2}): filename.cs: functionName({3}) > log contents line {4}`r`n" -f $ts3, $p_id, $tid, ($i % 1000), $i
    [void]$sb.Append($line)
    if ($i % 5000 -eq 0) { [System.IO.File]::AppendAllText($file3, $sb.ToString()); $sb.Clear() }
}
[System.IO.File]::AppendAllText($file3, $sb.ToString())

Write-Host "All files generated in $logDir"
