const fs = require('fs');

function createTestFile(filename, content) {
    fs.writeFileSync(filename, Buffer.from(content, 'utf8'));
}

createTestFile('test1.log', 'A\nB\n'); // 2 newlines
createTestFile('test2.log', 'A\nB'); // 1 newline
createTestFile('test3.log', 'A\r\nB\r\n'); // CRLF
createTestFile('test4.log', 'A\rB\nC'); // Stray CR

console.log('Test files created');
