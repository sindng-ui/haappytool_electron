const fs = require('fs');

try {
    let code = fs.readFileSync('workers/LogProcessor.worker.ts', 'utf-8');

    console.log("Original size:", code.length);

    // 1. imports
    code = code.replace(
        /\/\/ Bookmarks \(0-based Original Index\)\nlet originalBookmarks: Set<number> = new Set\(\);/,
        "import { BookmarkManager } from './workerBookmarkHandlers';\nimport * as DataReader from './workerDataReader';\n\n// Bookmarks managed by BookmarkManager"
    );

    // 2. remove binarySearch and getVisualBookmarks (up to Match Logic)
    const searchStart = code.indexOf('// --- Helper: Binary Search ---');
    const matchLogicStart = code.indexOf('// --- Helper: Match Logic ---');
    if (searchStart !== -1 && matchLogicStart !== -1) {
        const replaceWith = "// --- Helper: Get Visual Bookmarks ---\n" +
            "const invalidateBookmarkCache = () => BookmarkManager.invalidateCache();\n" +
            "const getVisualBookmarks = (): number[] => BookmarkManager.getVisualBookmarks(filteredIndices);\n\n";
        code = code.substring(0, searchStart) + replaceWith + code.substring(matchLogicStart);
    } else {
        console.error("Could not find searchStart or matchLogicStart");
    }

    // 3. originalBookmakrs.clear
    code = code.replace(/originalBookmarks\.clear\(\);/g, "BookmarkManager.clearAll();");

    // 4. Extract data readers & analyzeTransaction
    const getLinesStart = code.indexOf('// --- Handler: Get Lines ---');
    const analyzePerfStart = code.indexOf('// --- Handler: Analyze Performance (New) ---');
    if (getLinesStart !== -1 && analyzePerfStart !== -1) {
        const replaceWith = `// --- Helper: Get DataReader Context ---
const getDataReaderContext = (): DataReader.DataReaderContext => ({
    filteredIndices,
    isStreamMode,
    streamLines,
    currentFile,
    lineOffsets,
    currentRule,
    respond,
    postMessage: ctx.postMessage.bind(ctx)
});

`;
        code = code.substring(0, getLinesStart) + replaceWith + code.substring(analyzePerfStart);
    } else {
        console.error("Could not find getLinesStart or analyzePerfStart");
    }

    // 5. Replace switch cases
    code = code.replace(
        /case 'TOGGLE_BOOKMARK':\n\s+toggleBookmark\(payload\.visualIndex\);\n\s+break;/g,
        "case 'TOGGLE_BOOKMARK':\n            BookmarkManager.toggleBookmark(payload.visualIndex, filteredIndices, respond);\n            break;"
    );
    code = code.replace(
        /case 'CLEAR_BOOKMARKS':\n\s+clearBookmarks\(\);\n\s+break;/g,
        "case 'CLEAR_BOOKMARKS':\n            BookmarkManager.clearBookmarks(respond);\n            break;"
    );
    code = code.replace(
        /case 'GET_LINES':\n\s+getLines\(payload\.startLine, payload\.count, requestId \|\| ''\);\n\s+break;/g,
        "case 'GET_LINES':\n            DataReader.getLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');\n            break;"
    );
    code = code.replace(
        /case 'GET_RAW_LINES':\n\s+getRawLines\(payload\.startLine, payload\.count, requestId \|\| ''\);\n\s+break;/g,
        "case 'GET_RAW_LINES':\n            DataReader.getRawLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');\n            break;"
    );
    code = code.replace(
        /case 'GET_LINES_BY_INDICES':\n\s+getLinesByIndices\(payload\.indices, requestId \|\| ''\);\n\s+break;/g,
        "case 'GET_LINES_BY_INDICES':\n            DataReader.getLinesByIndices(getDataReaderContext(), payload.indices, requestId || '');\n            break;"
    );
    code = code.replace(
        /case 'FIND_HIGHLIGHT':\n\s+findHighlight\(payload\.keyword, payload\.startIndex, payload\.direction, requestId \|\| ''\);\n\s+break;/g,
        "case 'FIND_HIGHLIGHT':\n            DataReader.findHighlight(getDataReaderContext(), payload.keyword, payload.startIndex, payload.direction, requestId || '');\n            break;"
    );
    code = code.replace(
        /case 'GET_FULL_TEXT' as any: \/\/ Cast for now until types updated\n\s+getFullText\(requestId \|\| ''\);\n\s+break;/g,
        "case 'GET_FULL_TEXT' as any: // Cast for now until types updated\n            DataReader.getFullText(getDataReaderContext(), requestId || '');\n            break;"
    );

    // Save
    fs.writeFileSync('workers/LogProcessor.worker.ts', code, 'utf-8');
    console.log("Modified size:", code.length);

} catch (e) {
    console.error(e);
}
