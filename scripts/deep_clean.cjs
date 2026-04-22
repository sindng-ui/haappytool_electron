const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('형님, 묵은 때를 싹 벗겨내는 "딥 클린(Deep Clean)"을 시작함다! 🐧🧹✨');

/**
 * 전용 폴더 삭제 함수 (재귀)
 */
function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        console.log(`삭제 중: ${directoryPath}`);
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
}

// 1. Vite 의존성 최적화 캐시 날리기 (가장 중요!)
const viteCachePath = path.join(process.cwd(), 'node_modules', '.vite');
deleteFolderRecursive(viteCachePath);

// 2. 빌드 결과물 폴더 날리기
const distPath = path.join(process.cwd(), 'dist');
const distElectronPath = path.join(process.cwd(), 'dist_electron');
deleteFolderRecursive(distPath);
deleteFolderRecursive(distElectronPath);

// 3. 실행 중인 좀비 프로세스 정리 (scripts/cleanup_build.cjs 재활용)
try {
    console.log('실행 중인 좀비 프로세스(HappyTool.exe)를 소탕함다...');
    execSync('taskkill /F /IM HappyTool.exe /T', { stdio: 'ignore' });
} catch (e) {
    // 프로세스가 없는 경우 패스
}

// 4. (부가 서비스) Electron GPU/Code Cache 안내
console.log('\n--------------------------------------------------');
console.log('💡 형님, 만약 그래도 느리다면 아래 폴더도 수동으로 날려보십쇼:');
console.log(`   %APPDATA%\\happytool\\Cache`);
console.log(`   %APPDATA%\\happytool\\GPUCache`);
console.log('--------------------------------------------------\n');

console.log('딥 클린 완료! 이제 "npm run electron:dev"로 쾌속 부팅을 즐기십쇼! 🚀🐧');
process.exit(0);
