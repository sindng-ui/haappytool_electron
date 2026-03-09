const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('형님, 빌드 전에 방해되는 프로세스들을 정리하겠슴다! 🐧🧹');

// 1. HappyTool 관련 프로세스 종료 시도 (Windows 환경)
try {
    console.log('실행 중인 HappyTool 프로세스를 찾아서 종료함다...');
    // /F: 강제 종료, /IM: 이미지 이름, /T: 자식 프로세스까지
    execSync('taskkill /F /IM HappyTool.exe /T', { stdio: 'ignore' });
    console.log('기존 프로세스를 성공적으로 종료했슴다.');
} catch (e) {
    // 프로세스가 없는 경우 에러가 발생하므로 무시함다.
    console.log('종료할 기존 프로세스가 없거나 이미 종료되었슴다.');
}

// 2. dist_electron 내의 잠긴 파일(debug.log) 삭제 시도
const debugLogPath = path.join(__dirname, '..', 'dist_electron', 'win-unpacked', 'debug.log');
if (fs.existsSync(debugLogPath)) {
    try {
        console.log(`잠긴 로그 파일 삭제 시도: ${debugLogPath}`);
        fs.unlinkSync(debugLogPath);
        console.log('로그 파일을 삭제했슴다.');
    } catch (e) {
        console.log('로그 파일 삭제에 실패했슴다. 빌드 도중 자동으로 처리되길 기도합시다... 🙏');
        console.log(`에러 내용: ${e.message}`);
    }
}

console.log('정리 완료! 이제 마음 놓고 빌드하십쇼! 🚀');
process.exit(0);
