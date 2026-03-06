const fs = require('fs');
const crypto = require('crypto');

// Generate 50MB random text with \r, \n sparingly
const buf = Buffer.alloc(50 * 1024 * 1024);
for (let i = 0; i < buf.length; i++) {
    buf[i] = 65 + (i % 26);
    if (i % 120 === 0) buf[i] = 10;
    if (i % 3100 === 0) buf[i] = 13;
}

console.log('Buffer generated');

function testIndexOf(chunk) {
    let count = 0;
    let pos = -1;
    let start = process.hrtime.bigint();
    while ((pos = chunk.indexOf(10, pos + 1)) !== -1) {
        count++;
    }
    let end = process.hrtime.bigint();
    console.log('indexOf \n: ', Number(end - start) / 1000000, 'ms', count);
}

function testForLoop(chunk) {
    let count = 0;
    let start = process.hrtime.bigint();
    const len = chunk.length;
    let pendingCROffset = -1n;
    let offset = 0n;

    for (let i = 0; i < len; i++) {
        const b = chunk[i];
        if (b === 10) {
            count++;
        } else if (b === 13) {
            if (i + 1 < len) {
                if (chunk[i + 1] === 10) {
                    i++;
                    count++;
                } else {
                    count++;
                }
            } else {
                pendingCROffset = offset + BigInt(i);
            }
        }
    }
    let end = process.hrtime.bigint();
    console.log('for loop:   ', Number(end - start) / 1000000, 'ms', count);
}

testIndexOf(buf);
testForLoop(buf);
testIndexOf(buf);
testForLoop(buf);
testIndexOf(buf);
testForLoop(buf);
