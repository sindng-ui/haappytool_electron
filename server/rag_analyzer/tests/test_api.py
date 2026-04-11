import pytest
from fastapi.testclient import TestClient
import sys
import os

# 🐧 형님, 상위 디렉토리의 main을 임포트하기 위해 경로를 추가합니다!
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app

client = TestClient(app)

def test_read_root():
    """🐧 메인 루트 엔드포인트가 잘 작동하는지 확인합니다."""
    response = client.get("/")
    assert response.status_code == 200
    assert "running" in response.json()["message"]

def test_get_status():
    """🐧 서버 상태 체크 엔드포인트가 올바른 형식을 반환하는지 확인합니다."""
    response = client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert "total_indexed_issues" in data
    assert "db_path" in data

def test_search_validation():
    """🐧 쿼리 파라미터가 없을 때 422 에러가 잘 나오는지 확인합니다."""
    response = client.get("/search")
    assert response.status_code == 422

def test_search_example():
    """🐧 검색 기능이 정상적으로 결과를 반환하는지 확인합니다."""
    # 주의: 실제로 DB에 데이터가 있어야 성공하지만, 
    # 여기서는 구조적 유효성만 먼저 체크합니다.
    response = client.get("/search?q=crash")
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "hints" in data
    assert isinstance(data["hints"], list)
