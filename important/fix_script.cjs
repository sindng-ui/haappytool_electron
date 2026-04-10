const fs = require('fs');

let code = fs.readFileSync('workers/LogProcessor.worker.ts', 'utf-8');

// 1. imports
code = code.replace(
    /\/\* eslint-disable no-restricted-globals \*\/\r?\nimport \{ LogRule, LogWorkerMessage, LogWorkerResponse \} from '\.\.\/types';/,
    "/* eslint-disable no-restricted-globals */\nimport { LogRule, LogWorkerMessage, LogWorkerResponse } from '../types';\nimport { BookmarkManager } from './workerBookmarkHandlers';\nimport * as DataReader from './workerDataReader';"
);

// 2. originalBookmarks declaration
code = code.replace(
    /\/\/ Bookmarks \(0-based Original Index\)\r?\nlet originalBookmarks: Set<number> = new Set\(\);/,
    "// Bookmarks managed by BookmarkManager"
);

// 3. Switch cases
code = code.replace(
    /case 'TOGGLE_BOOKMARK':\r?\n\s+toggleBookmark\(payload\.visualIndex\);\r?\n\s+break;/g,
    "case 'TOGGLE_BOOKMARK':\n            BookmarkManager.toggleBookmark(payload.visualIndex, filteredIndices, respond);\n            break;"
);
code = code.replace(
    /case 'CLEAR_BOOKMARKS':\r?\n\s+clearBookmarks\(\);\r?\n\s+break;/g,
    "case 'CLEAR_BOOKMARKS':\n            BookmarkManager.clearBookmarks(respond);\n            break;"
);
code = code.replace(
    /case 'GET_LINES':\r?\n\s+getLines\(payload\.startLine, payload\.count, requestId \|\| ''\);\r?\n\s+break;/g,
    "case 'GET_LINES':\n            DataReader.getLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');\n            break;"
);
code = code.replace(
    /case 'GET_RAW_LINES':\r?\n\s+getRawLines\(payload\.startLine, payload\.count, requestId \|\| ''\);\r?\n\s+break;/g,
    "case 'GET_RAW_LINES':\n            DataReader.getRawLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');\n            break;"
);
code = code.replace(
    /case 'GET_LINES_BY_INDICES':\r?\n\s+getLinesByIndices\(payload\.indices, requestId \|\| ''\);\r?\n\s+break;/g,
    "case 'GET_LINES_BY_INDICES':\n            DataReader.getLinesByIndices(getDataReaderContext(), payload.indices, requestId || '');\n            break;"
);
code = code.replace(
    /case 'FIND_HIGHLIGHT':\r?\n\s+findHighlight\(payload\.keyword, payload\.startIndex, payload\.direction, requestId \|\| ''\);\r?\n\s+break;/g,
    "case 'FIND_HIGHLIGHT':\n            DataReader.findHighlight(getDataReaderContext(), payload.keyword, payload.startIndex, payload.direction, requestId || '');\n            break;"
);
code = code.replace(
    /case 'GET_FULL_TEXT' as any: \/\/ Cast for now until types updated\r?\n\s+getFullText\(requestId \|\| ''\);\r?\n\s+break;/g,
    "case 'GET_FULL_TEXT' as any: // Cast for now until types updated\n            DataReader.getFullText(getDataReaderContext(), requestId || '');\n            break;"
);

fs.writeFileSync('workers/LogProcessor.worker.ts', code, 'utf-8');
console.log("Fix complete");
