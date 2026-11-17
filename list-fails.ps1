npm test > test-run.txt 2>&1
Select-String -Path test-run.txt -Pattern '^not ok' | Select-Object -First 10 | ForEach-Object { $_.Line }
Select-String -Path test-run.txt -Pattern 'error: ' | Select-Object -First 6 | ForEach-Object { $_.Line.Trim().Substring(0, [Math]::Min(120, $_.Line.Trim().Length)) }
Remove-Item test-run.txt
