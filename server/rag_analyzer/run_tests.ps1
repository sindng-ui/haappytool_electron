# 🐧🎯 형님! PowerShell에서도 RAG 서버 테스트를 신나게 돌려보겠습니다! 🧪🚀

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "🧪 RAG Server Unit Test Runner (PowerShell)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 가상환경 확인
if (Test-Path "./venv") {
    Write-Host "📦 가상환경(venv)을 발견했습니다. 활성화합니다..." -ForegroundColor Yellow
    & .\venv\Scripts\Activate.ps1
}

# 필요한 패키지 설치 확인
Write-Host "🔍 테스트 의존성 패키지 확인 중..." -ForegroundColor Gray
pip install -q pytest httpx

# 테스트 환경 설정 (인메모리 DB 사용 강제)
$env:RAG_ENV = "test"
$env:RAG_DB_PATH = "./test_chroma_db"

# pytest 실행
Write-Host "🚀 pytest 가동합니다!" -ForegroundColor Green
pytest -v tests/

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 형님! 모든 테스트를 기가 막히게 통과했습니다! 🐧🛡️✨" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ 앗, 형님! 일부 테스트가 실패했습니다. 로그를 확인해 주십시오! 🐧💦" -ForegroundColor Red
}

Pop-Location
Write-Host "====================================================" -ForegroundColor Cyan
