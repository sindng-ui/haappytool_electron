from fastapi import FastAPI, Query
import chromadb
from chromadb.utils import embedding_functions
import os
from typing import List, Dict

# 🐧🎯 형님, RAG 분석 서버 본체가 왔습니다! 
app = FastAPI(title="SW Issue Analyst RAG (Mock)")

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

    return {
        "query": q,
        "hints": formatted_results
    }

@app.get("/status")
async def get_status():
    return {
        "total_indexed_issues": collection.count(),
        "db_path": db_path
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
