import JSZip from '../vendor/jszip-bundle.js';


import { SoFileItem } from '../types';

/**
 * Repackages a Nupkg zip file by replacing SO files and excluding unchecked architectures.
 * 
 * @param originalZip JSZip object of the original nupkg
 * @param soFiles List of SO file items with their checked status and blobs
 * @returns Blob of the new nupkg
 */
export async function repackageNupkg(
    originalZip: JSZip,
    soFiles: SoFileItem[]
): Promise<Blob> {
    const newZip = new JSZip();
    const entries = originalZip.files;
    
    // 1. Identify folders to exclude (RID folders for unchecked SOs)
    const excludedFolders = new Set<string>();
    soFiles.forEach(so => {
        if (!so.checked) {
            // Path pattern: runtimes/[RID]/native/[something].so
            const parts = so.path.split('/');
            if (parts[0] === 'runtimes' && parts.length >= 3) {
                const ridFolder = `runtimes/${parts[1]}/`;
                excludedFolders.add(ridFolder);
            } else {
                excludedFolders.add(so.path);
            }
        }
    });

    // 2. SO File map for fast lookup
    const soMap = new Map<string, Blob>();
    soFiles.forEach(so => {
        if (so.checked) {
            soMap.set(so.path, so.signedBlob || so.originalBlob);
        }
    });

    // 3. Process all entries
    for (const [path, entry] of Object.entries(entries)) {
        if (entry.dir) continue; // JSZip adds files with their full paths anyway

        // Check exclusion
        let shouldExclude = false;
        for (const excludedPath of excludedFolders) {
            if (path.startsWith(excludedPath)) {
                shouldExclude = true;
                break;
            }
        }

        if (shouldExclude) continue;

        if (soMap.has(path)) {
            // Replace with signed/original blob
            newZip.file(path, soMap.get(path)!);
        } else {
            // Copy as-is
            const content = await entry.async('blob');
            newZip.file(path, content);
        }
    }

    // 4. Generate final blob
    return await newZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

/**
 * Extracts metadata and original blobs for all .so files in runtimes/ folders.
 * 
 * @param zip JSZip object of the nupkg
 * @returns List of SoFileItem
 */
export async function extractSoFilesFromZip(zip: JSZip): Promise<SoFileItem[]> {
    const soItems: SoFileItem[] = [];
    
    for (const [path, entry] of Object.entries(zip.files)) {
        if (!entry.dir && path.includes('runtimes/') && path.endsWith('.so')) {
            const blob = await entry.async('blob');
            soItems.push({
                path,
                basename: path.split('/').pop() || path,
                originalBlob: blob,
                checked: true,
            });
        }
    }
    
    return soItems;
}
