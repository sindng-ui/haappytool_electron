import re

log_path = '/mnt/k/Antigravity_Projects/gitbase/logs/test_tizen_10mb.log'
target_key = 'SmartThingsApp.cs::OnCreate(66)'

def extract_source_metadata(line):
    # Standard format: FileName.ext: FunctionName(Line)>
    file_match = re.search(r'([\w\-\.]+\.(?:cs|cpp|h|java|kt|js|ts|tsx|py|c|h|cc|hpp|m|mm))\s*:', line, re.IGNORECASE)
    if not file_match:
        return None, None
    
    file_name = file_match.group(1)
    after_file = line[file_match.end():].strip()
    
    func_match = re.search(r'^([^>]+)(?:>)', after_file)
    function_name = func_match.group(1).strip() if func_match else None
    
    return file_name, function_name

def simulate():
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        print(f"Total lines: {len(lines)}")
        
        spam_map = {}
        
        for i, line in enumerate(lines):
            file_name, function_name = extract_source_metadata(line)
            if file_name or function_name:
                key = f"{file_name or 'unknown'}::{function_name or 'unknown'}"
                if key not in spam_map:
                    spam_map[key] = {'count': 0, 'indices': []}
                
                spam_map[key]['count'] += 1
                spam_map[key]['indices'].append(i)
                
        if target_key in spam_map:
            result = spam_map[target_key]
            print(f"Target: {target_key}")
            print(f"Count: {result['count']}")
            print("Indices (40-45):")
            print(result['indices'][40:45])
            
            # Check occurrence 42
            idx = result['indices'][41]
            print(f"Line at index {idx} (Occurrence 42): {lines[idx].strip()}")
        else:
            print(f"Target {target_key} not found!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    simulate()
