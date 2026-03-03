import os
import random
import time

def generate_large_log(file_path, target_lines=12000000):
    current_lines = 0
    
    levels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]
    tags = ["SystemUI", "PowerManager", "ActivityManager", "AudioService", "WifiService", "Bluetooth", "InputMethod"]
    messages = [
        "Sending signal to process 1234",
        "Connection established to 192.168.0.10",
        "Battery level changed: 75%",
        "Screen turned on for user 0",
        "Starting activity: com.example.app/.MainActivity",
        "Resource not found: icon_home.png",
        "Socket timeout while reading from stream",
        "GC_FOR_ALLOC freed 1024K, 15% free 14MB/16MB",
        "Vibrator started for process 5678",
        "Keyboard visibility changed to true"
    ]
    
    start_time = time.time()
    last_update = start_time
    
    print(f"Generating {target_lines:,} lines of log at: {file_path}")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        while current_lines < target_lines:
            tag = random.choice(tags).upper()
            uptime = f"{random.uniform(0, 5000):.3f}"
            level_char = random.choice(["I", "D", "W", "E", "V"])
            pid = random.randint(100, 9999)
            tid = random.randint(100, 9999)
            filename = random.choice(["system.cpp", "network.cpp", "ui_manager.js", "database.kt", "input_handler.cpp"])
            funcname = random.choice(["init", "onHandle", "processData", "updateState", "cleanup"])
            line_no = random.randint(1, 1500)
            msg = random.choice(messages)
            
            line = f"   {tag}: {uptime} {level_char}/{tag}(P {pid} T {tid}): {filename}: {funcname}({line_no})> {msg}\n"
            f.write(line)
            
            current_lines += 1
            
            # Progress update every 5 seconds
            now = time.time()
            if now - last_update > 5:
                progress = (current_lines / target_lines) * 100
                print(f"Progress: {progress:.1f}% ({current_lines:,} lines)", flush=True)
                last_update = now
                
    print(f"\nCompleted! Total lines: {current_lines:,}")
    print(f"File size: {os.path.getsize(file_path) / (1024*1024*1024):.2f} GB")
    print(f"Time taken: {time.time() - start_time:.1f} seconds")

if __name__ == "__main__":
    path = "test_12m.log"
    generate_large_log(path, 12000000)
                
    print(f"\nCompleted! Total size: {os.path.getsize(file_path) / (1024*1024*1024):.2f} GB")
    print(f"Time taken: {time.time() - start_time:.1f} seconds")

if __name__ == "__main__":
    # In WSL, this script will run. We can specify a relative path or a direct filename.
    path = "test_1g.log"
    generate_large_log(path, 1)
