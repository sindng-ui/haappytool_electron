import re

log_path = '/mnt/k/Antigravity_Projects/gitbase/logs/test_tizen_10mb.log'
target_key = 'SmartThingsApp.cs::OnCreate(66)'
filter_word = 'ST_APP'

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
            all_lines = f.readlines()
            
        print(f"Total lines in file: {len(all_lines)}")
        
        # 1. Simulate Filtering (ST_APP)
        filtered_indices = []
        for i, line in enumerate(all_lines):
            if filter_word in line:
                filtered_indices.append(i)
        
        print(f"Filtered lines (Matches): {len(filtered_indices)}")
        
        # 2. Simulate Spam Analysis on Filtered Results
        spam_map = {}
        for j, original_idx in enumerate(filtered_indices):
            line = all_lines[original_idx]
            file_name, function_name = extract_source_metadata(line)
            if file_name or function_name:
                key = f"{file_name or 'unknown'}::{function_name or 'unknown'}"
                if key not in spam_map:
                    spam_map[key] = {'count': 0, 'indices': []}
                
                spam_map[key]['count'] += 1
                spam_map[key]['indices'].append(j) # j is the filtered row index
                
        if target_key in spam_map:
            result = spam_map[target_key]
            print(f"Target: {target_key}")
            print(f"Count: {result['count']}")
            
            print("\nAll Occurrences within Filtered Rows:")
            for m, filter_idx in enumerate(result['indices']):
                orig_idx = filtered_indices[filter_idx]
                print(f"Occurr {m+1} (Filtered Row #{filter_idx}): Original Line {orig_idx + 1}")
                if (m+1) >= 54 and (m+1) <= 62:
                     print(f"  -> Content: {all_lines[orig_idx].strip()}")
        else:
            print(f"Target {target_key} not found in filtered results!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    simulate()
