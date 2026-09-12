$base = 'https://taskpulse-saas.onrender.com'
try {
  $h = Invoke-WebRequest -Uri "$base/api/health" -UseBasicParsing -TimeoutSec 30
  Write-Output ("HEALTH " + $h.StatusCode + " " + $h.Content)
} catch { Write-Output ("HEALTH_ERR " + $_.Exception.Message) }
try {
  $p = Invoke-WebRequest -Uri "$base/api/org/plan" -UseBasicParsing -TimeoutSec 30
  Write-Output ("PLAN " + $p.StatusCode + " " + $p.Content)
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Output ("PLAN_ERR " + $code)
}
try {
  $r = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 30
  $html = $r.Content
  Write-Output ("HOME_LEN " + $html.Length)
  Write-Output ("HAS_NEW_CARDS " + ($html -match 'multi-e|Cong|hero-sub'))
} catch { Write-Output ("HOME_ERR " + $_.Exception.Message) }
