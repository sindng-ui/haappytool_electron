import { ReleaseItem } from '../types';

export const exportToJson = (items: ReleaseItem[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "release_history.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

export const importFromJson = (jsonString: string): ReleaseItem[] | null => {
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            // Basic validation (allow both releaseName and appName for backward compatibility)
            const valid = parsed.every(item => item.id && (item.releaseName || item.appName) && item.productName);
            if (valid) {
                return parsed.map(item => ({
                    ...item,
                    releaseName: item.releaseName || item.appName || 'Unknown'
                }));
            }
        }
        return null;
    } catch (e) {
        console.error("Invalid JSON format", e);
        return null;
    }
};

export const exportToMarkdown = (items: ReleaseItem[]) => {
    // Sort items by date descending
    const sorted = [...items].sort((a, b) => b.releaseDate - a.releaseDate);
    
    let markdown = `# Release History\n\n`;
    markdown += `| Release | Product | Version | Date | Notes |\n`;
    markdown += `| :--- | :--- | :--- | :--- | :--- |\n`;

    sorted.forEach(item => {
        const date = new Date(item.releaseDate).toLocaleDateString();
        const noteSummary = item.note.split('\n')[0].replace(/\|/g, '\\|') || '-';
        markdown += `| ${item.releaseName} | ${item.productName} | ${item.version} | ${date} | ${noteSummary} |\n`;
    });

    // Copy to clipboard
    navigator.clipboard.writeText(markdown).catch(err => {
        console.error('Failed to copy markdown: ', err);
    });
    
    return markdown;
};

export const downloadDataUri = (dataUri: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
