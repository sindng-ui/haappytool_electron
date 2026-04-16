import JSZip from 'jszip';
import { repackageNupkg, extractSoFilesFromZip } from '../../../components/NupkgSigner/utils/nupkgUtils';
import { SoFileItem } from '../../../components/NupkgSigner/types';

describe('nupkgUtils - repackageNupkg', () => {
    
    it('should replace SO files with signed versions', async () => {
        // Setup original ZIP
        const originalZip = new JSZip();
        originalZip.file('runtimes/linux-x64/native/libtest.so', 'original content');
        originalZip.file('test.txt', 'meta data');

        const soFiles: SoFileItem[] = [{
            path: 'runtimes/linux-x64/native/libtest.so',
            basename: 'libtest.so',
            originalBlob: new Blob(['original content']),
            signedBlob: new Blob(['signed content']),
            checked: true
        }];

        const resultBlob = await repackageNupkg(originalZip, soFiles);
        const resultZip = await JSZip.loadAsync(resultBlob);

        // Verify replacement
        const replacedContent = await resultZip.file('runtimes/linux-x64/native/libtest.so')?.async('string');
        expect(replacedContent).toBe('signed content');

        // Verify other files are preserved
        const metaContent = await resultZip.file('test.txt')?.async('string');
        expect(metaContent).toBe('meta data');
    });

    it('should exclude folders when SO file is unchecked', async () => {
        const originalZip = new JSZip();
        originalZip.file('runtimes/linux-x64/native/libtest.so', 'content');
        originalZip.file('runtimes/linux-x64/native/unused.txt', 'unused');
        originalZip.file('runtimes/win-x86/native/win.so', 'win content');
        originalZip.file('root.txt', 'root');

        const soFiles: SoFileItem[] = [
            {
                path: 'runtimes/linux-x64/native/libtest.so',
                basename: 'libtest.so',
                originalBlob: new Blob(['content']),
                checked: false // UNCHECKED -> should exclude 'runtimes/linux-x64/'
            },
            {
                path: 'runtimes/win-x86/native/win.so',
                basename: 'win.so',
                originalBlob: new Blob(['win content']),
                checked: true
            }
        ];

        const resultBlob = await repackageNupkg(originalZip, soFiles);
        const resultZip = await JSZip.loadAsync(resultBlob);

        // Verify exclusion
        expect(resultZip.file('runtimes/linux-x64/native/libtest.so')).toBeNull();
        expect(resultZip.file('runtimes/linux-x64/native/unused.txt')).toBeNull();
        
        // Verify preservation
        expect(resultZip.file('runtimes/win-x86/native/win.so')).not.toBeNull();
        expect(resultZip.file('root.txt')).not.toBeNull();
    });

    it('should handle unusual paths by excluding only the file if RID folder structure is missing', async () => {
        const originalZip = new JSZip();
        originalZip.file('custom/lib.so', 'content');
        originalZip.file('custom/other.txt', 'keep');

        const soFiles: SoFileItem[] = [{
            path: 'custom/lib.so',
            basename: 'lib.so',
            originalBlob: new Blob(['content']),
            checked: false
        }];

        const resultBlob = await repackageNupkg(originalZip, soFiles);
        const resultZip = await JSZip.loadAsync(resultBlob);

        expect(resultZip.file('custom/lib.so')).toBeNull();
        expect(resultZip.file('custom/other.txt')).not.toBeNull(); // Should not exclude 'custom/' because it's not 'runtimes/'
    });
});

describe('nupkgUtils - extractSoFilesFromZip', () => {
    it('should extract .so files from runtimes/ folder', async () => {
        const zip = new JSZip();
        zip.file('runtimes/linux-x64/native/test.so', 'so content');
        zip.file('runtimes/win-x86/native/win.so', 'win content');
        zip.file('lib/net6.0/test.dll', 'not so');
        zip.file('test.so', 'root so - ignored');

        const soFiles = await extractSoFilesFromZip(zip);

        expect(soFiles).toHaveLength(2);
        expect(soFiles.find(f => f.path === 'runtimes/linux-x64/native/test.so')).toBeDefined();
        expect(soFiles.find(f => f.path === 'runtimes/win-x86/native/win.so')).toBeDefined();
        expect(soFiles.find(f => f.path === 'test.so')).toBeUndefined();
    });

    it('should return empty list if no .so files in runtimes/', async () => {
        const zip = new JSZip();
        zip.file('root.so', 'content');
        
        const soFiles = await extractSoFilesFromZip(zip);
        expect(soFiles).toHaveLength(0);
    });
});
