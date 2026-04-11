from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import chromadb
from chromadb.utils import embedding_functions
import os
import time
import logging
from typing import List, Dict

# 🐧🎯 형님, 로그 설정 들어가십니다!
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("rag_server.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("RAG_Server")

# 🐧🎯 형님, RAG 분석 서버 본체가 왔습니다! 
app = FastAPI(title="SW Issue Analyst RAG (Mock)")

# ✅ CORS 설정 추가: 브라우저(React)에서 접근할 수 있도록 허용합니다! 🐧🛡️
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB Client
current_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(current_dir, 'chroma_db')
client = chromadb.PersistentClient(path=db_path)
emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
collection = client.get_or_create_collection(name="sw_issues", embedding_function=emb_fn)

@app.get("/")
async def root():
    return {"message": "SW Issue Analyst RAG Server is running! 🐧🚀"}

@app.get("/search")
async def search_issues(q: str = Query(..., description="The symptom of the software issue")):
    """
    유사한 과거 사례를 검색하여 원인 및 해결책 힌트를 제공합니다.
    """
    start_time = time.time()
    
    # 🐧 검색 요청 로깅
    logger.info(f"🔍 Search Query: '{q}'")
    
    results = collection.query(
        query_texts=[q],
        n_results=3
    )

    formatted_results = []
    for i in range(len(results['ids'][0])):
        formatted_results.append({
            "id": results['ids'][0][i],
            "distance": results['distances'][0][i],
            "title": results['metadatas'][0][i]['title'],
            "root_cause_hint": results['metadatas'][0][i]['root_cause'],
            "resolution_hint": results['metadatas'][0][i]['resolution'],
            "component": results['metadatas'][0][i]['component']
        })

    duration = time.time() - start_time
    
    # 🐧 검색 완료 로깅
    logger.info(f"✅ Found {len(formatted_results)} results in {duration:.4f}s")
    
    return {
        "query": q,
        "hints": formatted_results,
        "search_time_ms": int(duration * 1000)
    }

@app.get("/status")
async def get_status():
    count = collection.count()
    logger.info(f"📊 Status check: {count} issues indexed.")
    return {
        "total_indexed_issues": count,
        "db_path": db_path
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting RAG Server on port 8888...")
    uvicorn.run(app, host="0.0.0.0", port=8888)
