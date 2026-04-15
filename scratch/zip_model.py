import os
import shutil
import zipfile
from sentence_transformers import SentenceTransformer

def zip_model():
    model_name = 'all-MiniLM-L6-v2'
    save_dir = '/mnt/k/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/models'
    zip_name = 'all-MiniLM-L6-v2.zip'
    target_zip_path = os.path.join(save_dir, zip_name)
    
    print(f"🔍 Searching for model: {model_name}...")
    
    # SentenceTransformer를 로드하여 실제 경로를 알아냅니다.
    model = SentenceTransformer(model_name)
    # SentenceTransformer 객체에서 모델이 저장된 실제 경로를 추출합니다.
    # 보통 모델 객체의 0번 모듈(Transformer)의 auto_model.config._name_or_path 등에 정보가 있습니다.
    model_path = model[0].auto_model.config._name_or_path
    
    if not os.path.exists(model_path):
        # 만약 위 방법으로 안나오면 캐시 경로를 직접 뒤져봅니다.
        # sentence-transformers는 보통 ~/.cache/torch/sentence_transformers/ 아래에 저장합니다.
        cache_base = os.path.expanduser('~/.cache/torch/sentence_transformers')
        potential_path = os.path.join(cache_base, 'sentence-transformers_' + model_name.replace('/', '_'))
        if os.path.exists(potential_path):
            model_path = potential_path
            
    if not os.path.exists(model_path):
        print(f"❌ Could not find model path for {model_name}. Please check if it's downloaded.")
        return

    print(f"📍 Found model at: {model_path}")
    
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
        
    # 임시 폴더 생성 (구조 유지용)
    temp_dir = os.path.join(save_dir, 'all-MiniLM-L6-v2')
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    print(f"📦 Copying files to {temp_dir}...")
    # 필터링해서 복사 (필요 없는 파일 제외 가능하지만 일단 전부)
    for root, dirs, files in os.walk(model_path):
        rel_path = os.path.relpath(root, model_path)
        dest_root = os.path.join(temp_dir, rel_path)
        if not os.path.exists(dest_root):
            os.makedirs(dest_root)
        for file in files:
            # .git 관련 파일이나 큰 불필요 파일 제외 가능
            if file.startswith('.git'): continue
            shutil.copy2(os.path.join(root, file), os.path.join(dest_root, file))
            
    print(f"🤐 Zipping to {target_zip_path}...")
    with zipfile.ZipFile(target_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # zip 안에서의 상대 경로 (all-MiniLM-L6-v2/...)
                arcname = os.path.relpath(file_path, save_dir)
                zipf.write(file_path, arcname)
                
    # 임시 폴더 삭제
    shutil.rmtree(temp_dir)
    print(f"✅ Successfully created {target_zip_path}!")

if __name__ == "__main__":
    zip_model()
