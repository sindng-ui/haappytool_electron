import { ReleaseItem, ReleaseHistoryData } from '../types';

export const exportToJson = (items: ReleaseItem[], yearConfigs?: Record<number, any>) => {
    const data: ReleaseHistoryData = { items, yearConfigs: yearConfigs || {} };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
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
        let items: any[] = [];
        
        if (Array.isArray(parsed)) {
            items = parsed;
        } else if (parsed && parsed.items && Array.isArray(parsed.items)) {
            items = parsed.items;
        } else {
            return null;
        }

        // Basic validation and migration
        const valid = items.every(item => item.id && (item.releaseName || item.appName));
        if (valid) {
            return items.map(item => {
                const releaseName = item.releaseName || item.appName || 'Unknown';
                let years = item.years;
                if (!years) {
                    if (item.productName && /^\d{4}$/.test(item.productName)) {
                        years = [parseInt(item.productName)];
                    } else {
                        years = [new Date(item.releaseDate).getFullYear()];
                    }
                }
                return {
                    ...item,
                    releaseName,
                    years
                };
            });
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
    markdown += `| Release | Years | Version | Date | Notes |\n`;
    markdown += `| :--- | :--- | :--- | :--- | :--- |\n`;

    sorted.forEach(item => {
        const date = new Date(item.releaseDate).toLocaleDateString();
        const noteSummary = item.note.split('\n')[0].replace(/\|/g, '\\|') || '-';
        const yearsStr = item.years.join(', ');
        markdown += `| ${item.releaseName} | ${yearsStr} | ${item.version} | ${date} | ${noteSummary} |\n`;
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
