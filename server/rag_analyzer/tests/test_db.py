import pytest
import os
import shutil
import chromadb
from chromadb.utils import embedding_functions

# 🐧 형님, 테스트용 DB 경로입니다.
TEST_DB_PATH = "./test_chroma_db"

# 🐧 형님, Windows의 파일 잠금 문제를 피하기 위해 
# 테스트에서는 디스크를 쓰지 않는 EphemeralClient(In-memory)를 사용합니다!
# 이렇게 하면 'WinError 32' 오류로부터 자유로워집니다. 🕵️‍♂️✨

def test_chroma_connection():
    """🐧 ChromaDB 클라이언트가 정상적으로 연결되고 컬렉션이 생성되는지 확인합니다."""
    # 🐧 메모리 DB를 사용하므로 별도의 경로 관리가 필요 없습니다.
    client = chromadb.EphemeralClient()
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    collection = client.get_or_create_collection(name="test_issues", embedding_function=emb_fn)
    
    assert collection is not None
    assert collection.count() == 0

def test_data_insertion_and_search():
    """🐧 데이터를 넣고 다시 검색했을 때 잘 나오는지 확인합니다."""
    client = chromadb.EphemeralClient()
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    collection = client.get_or_create_collection(name="test_issues", embedding_function=emb_fn)
    
    # 데이터 삽입
    collection.add(
        ids=["issue_01"],
        documents=["System crash during screen rotation in BGC mode"],
        metadatas=[{"title": "Screen Rotation Crash", "root_cause": "Null pointer", "resolution": "Fix null check", "component": "BGC"}]
    )
    
    assert collection.count() == 1
    
    # 검색 테스트
    results = collection.query(
        query_texts=["rotation crash"],
        n_results=1
    )
    
    assert len(results["ids"][0]) > 0
    assert results["ids"][0][0] == "issue_01"
    assert "Rotation" in results["metadatas"][0][0]["title"]
