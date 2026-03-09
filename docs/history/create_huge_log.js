import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'huge_tizen_log.log');
const lineCount = 1000000; // 형님, 화끈하게 100만 줄 갑니다!
const levels = ['V', 'D', 'I', 'W', 'E'];
const tags = ['ActivityManager', 'PowerManager', 'InputReader', 'WindowManager', 'LogExtractor', 'HyperCanvas', 'TizenRT', 'Dali'];
const messages = [
    'Successfully initialized rendering engine at 60fps.',
    'Processing message queue for incoming log streams...',
    'Detected high-speed scroll event, triggering hyper-overscan pre-fetch.',
    'Memory usage stable at expected thresholds.',
    'Failed to connect to remote device, retrying in 5s...',
    'User requested big-size log file for performance stress test.',
    'Optimizing canvas context for hardware acceleration.',
    'Cache cleared to make room for new log segments.',
    'Tizen WebAPI initialized successfully.',
    'Launching application: org.tizen.happy-tool'
];

console.log(`Creating ${lineCount.toLocaleString()} lines of Tizen log data...`);
const stream = fs.createWriteStream(filePath);

function pad(n, len = 2) {
    return String(n).padStart(len, '0');
}

for (let i = 1; i <= lineCount; i++) {
    const now = new Date();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const ms = pad(now.getMilliseconds(), 3);

    const level = levels[Math.floor(Math.random() * levels.length)];
    const tag = tags[Math.floor(Math.random() * tags.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const pid = Math.floor(Math.random() * 9000) + 1000;

    // Tizen 전형적인 dlog 포맷: 02-15 23:08:22.123 I/TAG( 1234): message
    const line = `${month}-${day} ${hours}:${minutes}:${seconds}.${ms} ${level}/${tag}(${pid}): [${i}] ${message}\n`;
    stream.write(line);

    if (i % 100000 === 0) {
        console.log(`Progress: ${i.toLocaleString()} / ${lineCount.toLocaleString()} lines...`);
    }
}

stream.end(() => {
    const stats = fs.statSync(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ 타이젠 성능 폭탄 생성 완료!:`);
    console.log(`경로: ${filePath}`);
    console.log(`줄 수: ${lineCount.toLocaleString()}`);
    console.log(`용량: ${sizeInMB} MB`);
    console.log(`\n형님, 이제 이 파일을 로그 추출기에 넣고 '타이젠' 모드로 돌려보세요! 🚀`);
});
