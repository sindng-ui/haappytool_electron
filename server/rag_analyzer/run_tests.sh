#!/bin/bash

# 🐧🎯 형님! RAG 서버 테스트를 신나게 돌려보겠습니다! 🐧🧪🚀

# 스크립트 위치 기준으로 경로 설정
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "===================================================="
echo "🧪 RAG Server Unit Test Runner"
echo "===================================================="

# 가상환경 확인 (선택 사항)
if [ -d "./venv" ]; then
    echo "📦 가상환경(venv)을 발견했습니다. 활성화합니다..."
    source ./venv/bin/activate
fi

# 필요한 패키지 설치 확인
echo "🔍 테스트 의존성 패키지 확인 중..."
pip install -q pytest httpx

# 테스트 환경 설정 (인메모리 DB 사용 강제)
export RAG_ENV="test"
export RAG_DB_PATH="./test_chroma_db"

# pytest 실행
echo "🚀 pytest 가동합니다!"
pytest -v tests/

# 결과 확인
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 형님! 모든 테스트를 기가 막히게 통과했습니다! 🐧🛡️✨"
else
    echo ""
    echo "❌ 앗, 형님! 일부 테스트가 실패했습니다. 로그를 확인해 주십시오! 🐧💦"
fi

echo "===================================================="
