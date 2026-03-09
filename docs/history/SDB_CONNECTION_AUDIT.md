# SDB 연결 전체 플로우 점검 보고서

## ✅ 정상 동작 확인 항목

### 1. Frontend (TizenConnectionModal.tsx)
- ✅ **sdbPath 상태 관리**: localStorage에서 불러오고 저장 (Line 46)
- ✅ **Quick Connect**: sdbPath 전달 (Line 151)
- ✅ **Manual Connect**: sdbPath 전달 (Line 342)
- ✅ **Device List Refresh**: sdbPath 전달 (Line 261)
- ✅ **Scan SDB (Remote)**: sdbPath 전달 (Line 271)
- ✅ **Timeout Logic**: 12초 타임아웃 설정 (Line 73-78)
- ✅ **saveToFile**: localStorage 영구 저장 (Line 57-60)
- ✅ **Status/Error Handling**: sdb_status, sdb_error 이벤트 수신

### 2. Backend (server/index.cjs)
- ✅ **list_sdb_devices**: 시스템 sdb 우선, fallback to sdbPath (Line 784-846)
- ✅ **connect_sdb**: sdbPath 파라미터 수신 및 사용 (Line 471+)
- ✅ **initiateSdbConnection**: getSdbBin(sdbPath) 사용 (Line 585, 617, 619, 640)
- ✅ **Verification Timeout**: 5초 타임아웃 (Line 591-598)
- ✅ **Auto-Recovery**: "target not found" 시 재연결 시도 (Line 611-627)
- ✅ **Log Streaming**: stdout을 socket.emit('log_data')로 전송 (Line 652-658)

## ⚠️ 발견된 잠재적 문제점

### 🔴 CRITICAL: connect_sdb_remote 핸들러 누락!

**문제:**
- Frontend에서 `socket.emit('connect_sdb_remote', { ip, sdbPath })` 호출 (Line 271)
- **Backend에 해당 핸들러가 존재하지 않음!**

**영향:**
- "Auto Scan (192.168.250.250)" 버튼 클릭 시 아무 일도 일어나지 않음
- 디바이스 목록이 갱신되지 않음

**해결 필요:**
Backend에 `connect_sdb_remote` 핸들러 추가 필요

### 🟡 MEDIUM: sdb_status: 'connected' 이벤트 누락

**문제:**
- Frontend는 `sdb_status`에서 `status === 'connected'`를 기대 (Line 210)
- Backend에서 **성공적으로 SDB 프로세스 시작 후 이 이벤트를 emit하지 않음**
- 단지 log_data만 전송하고 있음

**영향:**
- 모달이 닫히지 않음
- onStreamStart가 호출되지 않음
- 클라이언트는 12초 타임아웃까지 대기

**해결 필요:**
Line 640 이후 프로세스 시작 성공 시 다음 추가:
```javascript
socket.emit('sdb_status', { status: 'connected', message: 'SDB Connected' });
```

### 🟡 MEDIUM: Error 발생 시 debugStream/logFileStream 정리 누락

**문제:**
- 여러 에러 경로에서 stream cleanup이 되지만, 일부는 누락

**영향:**
- 파일 핸들 누수 가능성

## 📋 권장 수정사항

### 1. connect_sdb_remote 핸들러 추가
### 2. sdb_status: 'connected' 이벤트 emit 추가
### 3. getSdbBin 헬퍼 함수 일관성 확인

## 🎯 최우선 수정 사항

**connect_sdb에서 성공 시 sdb_status 이벤트 emit 누락이 가장 큰 문제입니다!**
