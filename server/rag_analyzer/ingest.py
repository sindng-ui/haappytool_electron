import os

# 🐧🎯 형님, SSL 인증서 검증 오류를 산산조각낼 V2 패치 들어갑니다!
# 모든 import 보다 먼저 실행되어 환경 변수를 선점해야 합니다.
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
os.environ['PYTHONHTTPSVERIFY'] = '0'

import json
import chromadb
from chromadb.utils import embedding_functions
import ssl
import urllib3

# 모든 경고 메시지 차단 (깔끔하게!)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ssl._create_default_https_context = ssl._create_unverified_context

# 🐧🎯 형님, 인덱싱 스크립트 들어갑니다! 
def ingest_data():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(current_dir, 'data', 'mock_issues.json')
    db_path = os.path.join(current_dir, 'chroma_db')

    # Load mock data
    with open(data_path, 'r', encoding='utf-8') as f:
        issues = json.load(f)

    # Initialize ChromaDB
    client = chromadb.PersistentClient(path=db_path)
    
    # 🐧🎯 형님, 로컬 모델 폴더 확인 로직 들어갑니다! 
    # models/all-MiniLM-L6-v2 폴더가 있으면 거기서 로드하고, 없으면 온라인에서 받습니다.
    model_name_or_path = "all-MiniLM-L6-v2"
    local_model_path = os.path.join(current_dir, 'models', 'all-MiniLM-L6-v2')
    
    if os.path.exists(local_model_path):
        print(f"📦 Found local model at {local_model_path}. Using it! 🐧✨")
        model_name_or_path = local_model_path
    else:
        print(f"🌐 Local model not found at {local_model_path}. Attempting online download... 🐧")

    # 임베딩 모델 로딩
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model_name_or_path)
    
    collection = client.get_or_create_collection(
        name="sw_issues",
        embedding_function=emb_fn
    )

    # Prepare data for indexing
    documents = []
    metadatas = []
    ids = []
    seen_ids = set()

    for issue in issues:
        issue_id = str(issue['id'])
        if issue_id in seen_ids:
            print(f"🐧 Warning: Duplicate ID {issue_id} found in JSON, skipping...")
            continue
            
        seen_ids.add(issue_id)
        
        # 🐧🎯 형님, 제목(title)과 증상(symptom)을 합쳐서 검색 효율을 높였습니다!
        searchable_text = f"Title: {issue['title']}\nSymptom: {issue['symptom']}"
        documents.append(searchable_text)
        
        # 나머지 정보는 메타데이터로 저장
        metadatas.append({
            "id": issue_id,
            "title": issue['title'],
            "root_cause": issue['root_cause'],
            "resolution": issue['resolution'],
            "component": issue['component']
        })
        ids.append(issue_id)

    # Upsert to collection (중복 ID는 업데이트, 새 ID는 추가)
    if documents:
        print(f"Indexing {len(documents)} issues into ChromaDB (Upsert mode)...")
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print("Ingestion completed successfully! 🐧✅")
    else:
        print("No new data to index. 🐧")

if __name__ == "__main__":
    ingest_data()
