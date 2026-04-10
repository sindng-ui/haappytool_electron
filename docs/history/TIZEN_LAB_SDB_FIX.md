# Tizen Lab SDB 연결 수정

## 문제
- File Explorer: sdbPath 전달은 되지만 확인 필요
- **App Manager: 서버 핸들러가 완전히 누락됨** ⚠️

## 필요한 작업

### 1. App Manager 서버 핸들러 추가
서버에 다음 핸들러들 추가 필요:
- `list_tizen_apps`: sdb shell app_launcher -l
- `launch_tizen_app`: sdb shell app_launcher -s <pkgId>
- `terminate_tizen_app`: sdb shell app_launcher -k <pkgId>
- `uninstall_tizen_app`: sdb shell pkgcmd uninstall -n <pkgId>

### 2. File Explorer 동작 확인
- 이미 sdbPath를 전달하고 있음 (Line 662)
- handleSdbCommand에서 처리하는지 확인

### 3. Performance Monitor 확인
- sdbPath 전달 여부 확인

## 우선순위
🔴 **CRITICAL**: App Manager 완전히 동작 안 함 (핸들러 누락)
🟡 File Explorer/Performance Monitor 확인
