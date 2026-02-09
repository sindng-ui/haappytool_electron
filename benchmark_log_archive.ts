
import { db } from './components/LogArchive/db/LogArchiveDB';

async function runBenchmark() {
    console.log('--- Log Archive Benchmark ---');

    // 1. Clear DB
    console.time('Clear DB');
    await db.clearAll();
    console.timeEnd('Clear DB');

    // 2. Insert 1000 items
    console.log('Inserting 1000 items...');
    console.time('Insert 1000');
    const items = [];
    for (let i = 0; i < 1000; i++) {
        items.push({
            title: `Log Entry ${i}`,
            content: `This is the content for log entry ${i}. It has some random text like error, warning, info.`,
            tags: i % 5 === 0 ? ['ERROR', 'NETWORK'] : ['INFO'],
            metadata: { folder: i % 10 === 0 ? 'Important' : 'General' },
            createdAt: Date.now() - i * 10000,
            updatedAt: Date.now()
        });
    }
    await db.archives.bulkAdd(items);
    console.timeEnd('Insert 1000');

    // 3. Get All Tags (Optimized)
    console.log('Getting all tags...');
    console.time('Get All Tags');
    const tags = await db.getAllTags();
    console.timeEnd('Get All Tags');
    console.log('Tags:', tags);

    // 4. Get All Folders (Optimized)
    console.log('Getting all folders...');
    console.time('Get All Folders');
    const folders = await db.getAllFolders();
    console.timeEnd('Get All Folders');
    console.log('Folders:', folders);

    // 5. Search (Regex)
    console.log('Searching (Regex: /error/i)...');
    console.time('Search Regex');
    const searchResults = await db.searchArchives({ query: 'error', isRegex: true, limit: 50 });
    console.timeEnd('Search Regex');
    console.log(`Found ${searchResults.length} items`);

    console.log('--- Benchmark Complete ---');
}

// Check if running in browser context where db is available
if (typeof window !== 'undefined') {
    (window as any).runBenchmark = runBenchmark;
    console.log('Benchmark script loaded. Run "runBenchmark()" in console.');
}
