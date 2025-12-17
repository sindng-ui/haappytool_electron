import pako from 'pako';

export interface ExtractedFile {
    name: string;
    data: Uint8Array;
}

// Simple CPIO (New ASCII) Parser
// Header is 110 bytes
// Magic: 070701 or 070702
const parseCpio = (buffer: Uint8Array, targetExt: string = '.tpk'): ExtractedFile | null => {
    let offset = 0;
    const decoder = new TextDecoder();

    while (offset < buffer.length - 110) {
        // Check magic (070701 or 070702)
        // 0-6: Magic
        if (buffer[offset] !== 48 || buffer[offset + 1] !== 55 || buffer[offset + 2] !== 48 || buffer[offset + 3] !== 55) {
            // Misaligned or end of valid data
            // Attempt to scan forward byte by byte to find next header? 
            // CPIO is usually 4-byte aligned.
            offset++;
            continue;
        }

        const magic = decoder.decode(buffer.slice(offset, offset + 6));
        if (magic !== '070701' && magic !== '070702') {
            offset++;
            continue;
        }

        const filesizeHex = decoder.decode(buffer.slice(offset + 54, offset + 62));
        const namesizeHex = decoder.decode(buffer.slice(offset + 94, offset + 102));

        const filesize = parseInt(filesizeHex, 16);
        const namesize = parseInt(namesizeHex, 16);

        const nameOffset = offset + 110;
        const filename = decoder.decode(buffer.slice(nameOffset, nameOffset + namesize - 1));

        let dataOffset = nameOffset + namesize;
        if (dataOffset % 4 !== 0) dataOffset += (4 - (dataOffset % 4));

        if (filename === 'TRAILER!!!') break;

        // Return the FIRST .tpk file found, regardless of path
        if (filename.endsWith(targetExt)) {
            const fileData = buffer.slice(dataOffset, dataOffset + filesize);
            console.log(`[TPK Extractor] Found .tpk file: ${filename} (${filesize} bytes)`);
            return { name: filename, data: fileData };
        }

        offset = dataOffset + filesize;
        if (offset % 4 !== 0) offset += (4 - (offset % 4));
    }

    return null;
};

export const extractTpkFromRpm = async (file: File, onProgress: (msg: string, step: number) => void): Promise<ExtractedFile> => {
    // 1. Read file to find GZIP signature
    // RPM usually has headers, then data.
    // We scan for 1F 8B

    onProgress('Reading file...', 1);
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    onProgress('Scanning for payload...', 2);
    let gzStart = -1;
    for (let i = 0; i < Math.min(uint8.length, 20000); i++) { // Scan first 20KB
        if (uint8[i] === 0x1F && uint8[i + 1] === 0x8B && uint8[i + 2] === 0x08) {
            gzStart = i;
            break;
        }
    }

    if (gzStart === -1) {
        // Fallback: Check if it's already a CPIO (e.g. uncompressed RPM payload or raw CPIO)
        onProgress('No GZIP found, checking for CPIO...', 2);
        const isCpio = (uint8[0] === 0x30 && uint8[1] === 0x37 && uint8[2] === 0x30 && uint8[3] === 0x37 && uint8[4] === 0x30); // 07070...
        if (isCpio) {
            onProgress('Parsing CPIO archive...', 4);
            const result = parseCpio(uint8, '.tpk');
            if (result) {
                onProgress('TPK Extracted!', 5);
                return result;
            }
        }

        throw new Error('No supported payload (GZIP or CPIO) found in RPM/File');
    }

    onProgress('Decompressing payload...', 3);
    const gzData = uint8.slice(gzStart);
    let cpioData: Uint8Array;

    try {
        cpioData = pako.inflate(gzData);
    } catch (e) {
        throw new Error('Decompression failed');
    }

    onProgress('Parsing CPIO archive...', 4);
    const result = parseCpio(cpioData, '.tpk');

    if (result) {
        onProgress('TPK Extracted!', 5);
        return result;
    } else {
        throw new Error('No .tpk file found within the RPM archive');
    }
};
