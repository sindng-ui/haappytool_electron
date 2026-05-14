const fs = require('fs');

let code = fs.readFileSync('workers/LogProcessor.worker.ts', 'utf-8');

// 1. 파일 중간에 위치한 import 구문을 찾아 제거
// 111-114라인 대략적 위치
const midImports = [
    /\r?\nimport \{ checkIsMatch \} from '\.\.\/utils\/logFiltering';/g,
    /\r?\nimport \{ extractTimestamp \} from '\.\.\/utils\/logTime';/g,
    /\r?\nimport \{ analyzePerfSegments, extractSourceMetadata \} from '\.\.\/utils\/perfAnalysis';/g,
    /\r?\nimport \* as AnalysisHandlers from '\.\/workerAnalysisHandlers';/g,
];

// 파일 상단의 import 블록 확인
const hasCheckIsMatch = code.includes("import { checkIsMatch }");
const hasAnalysisHandlers = code.includes("import * as AnalysisHandlers");

console.log("hasCheckIsMatch:", hasCheckIsMatch);
console.log("hasAnalysisHandlers:", hasAnalysisHandlers);

// 중복 import 제거 전략: 최상단(1~5번 줄)에 추가하고 이후 중복 제거
// 파일 첫 번째 import 위치 찾기
const firstImportEnd = code.indexOf("import * as DataReader from './workerDataReader';");
if (firstImportEnd === -1) {
    console.error("Could not find DataReader import");
    process.exit(1);
}
const insertPos = firstImportEnd + "import * as DataReader from './workerDataReader';".length;

// 이미 있으면 추가 안함
let insertions = '';
if (!code.substring(0, insertPos).includes("import { checkIsMatch }")) {
    insertions += "\nimport { checkIsMatch } from '../utils/logFiltering';";
}
if (!code.substring(0, insertPos).includes("import { extractTimestamp }")) {
    insertions += "\nimport { extractTimestamp } from '../utils/logTime';";
}
if (!code.substring(0, insertPos).includes("import { analyzePerfSegments,")) {
    insertions += "\nimport { analyzePerfSegments, extractSourceMetadata } from '../utils/perfAnalysis';";
}
if (!code.substring(0, insertPos).includes("import * as AnalysisHandlers")) {
    insertions += "\nimport * as AnalysisHandlers from './workerAnalysisHandlers';";
}

if (insertions) {
    code = code.substring(0, insertPos) + insertions + code.substring(insertPos);
    console.log("Inserted imports at top");
}

// 이제 파일 중간에 있는 임포트 중복 제거 (Helper Comment 이후에 있는 것들)
// 주석 이후에 있는 import 구문들 제거
code = code.replace(/(\n\/\/ --- Helper: Match Logic ---\r?\n\/\/ NOTE: Extracted to utils\/logFiltering\.ts for testability and reusability\r?\n)(import \{ checkIsMatch \} from '\.\.\/utils\/logFiltering';\r?\nimport \{ extractTimestamp \} from '\.\.\/utils\/logTime';\r?\nimport \{ analyzePerfSegments, extractSourceMetadata \} from '\.\.\/utils\/perfAnalysis';\r?\nimport \* as AnalysisHandlers from '\.\/workerAnalysisHandlers';)/g,
    '$1// (imports moved to top)');

fs.writeFileSync('workers/LogProcessor.worker.ts', code, 'utf-8');
console.log("Done");
