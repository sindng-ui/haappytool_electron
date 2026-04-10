import requests
import json

# 🐧🎯 형님, RAG 서버 테스트용 스크립트입니다.
def test_search(query):
    url = f"http://127.0.0.1:8888/search?q={query}"
    print(f"\n[Q] 신규 증상: {query}")
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print(f"\n[A] 분석 힌트 (가장 유사한 {len(data['hints'])}건):")
            for idx, hint in enumerate(data['hints'], 1):
                print(f"\n--- 힌트 #{idx} (유사도: {hint['distance']:.4f}) ---")
                print(f"과거 이슈: {hint['title']} ({hint['id']})")
                print(f"의심 원인: {hint['root_cause_hint']}")
                print(f"제안 조치: {hint['resolution_hint']}")
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"서버가 아직 실행 중이 아니거나 오류가 발생했습니다: {e}")

if __name__ == "__main__":
    # 테스트 케이스 1: 화면 회전 크래시와 유사한 질문
    test_search("BGC")
    
    # 테스트 케이스 2: 네트워크 타임아웃과 유사한 질문
    # test_search("uploading file takes too long and fails")
