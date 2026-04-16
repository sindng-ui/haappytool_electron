import JSZip from 'jszip';
import { repackageNupkg, extractSoFilesFromZip } from '../utils/nupkgUtils';

const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
    const { type, payload, requestId } = e.data;

    try {
        if (type === 'EXTRACT_SO') {
            const { file } = payload;
            const zip = await new JSZip().loadAsync(file);
            const soItems = await extractSoFilesFromZip(zip);
            ctx.postMessage({ type: 'EXTRACT_SO_COMPLETE', payload: soItems, requestId });
        } 
        else if (type === 'REPACKAGE') {
            const { originalZipData, soFiles } = payload;
            const contents = await new JSZip().loadAsync(originalZipData);
            const resultBlob = await repackageNupkg(contents, soFiles);
            ctx.postMessage({ type: 'REPACKAGE_COMPLETE', payload: resultBlob, requestId });
        }
    } catch (err: any) {
        ctx.postMessage({ type: 'ERROR', payload: err.message, requestId });
    }
};
