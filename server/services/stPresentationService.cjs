const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * SmartThings Device Presentation Dictionary Service
 * High-performance JSON file storage, schema parser, custom categorization, and asynchronous search.
 */
class STPresentationService {
    constructor() {
        this.baseDir = null;
        this.indexPath = null;
        this.categoriesPath = null;
        this.initialized = false;
    }

    /**
     * Initialize directories and index files
     */
    async ensureInitialized() {
        if (this.initialized) return;

        try {
            // Get userData path safely from Electron app
            const userDataPath = app.getPath('userData');
            this.baseDir = path.join(userDataPath, 'st_presentations');
            this.indexPath = path.join(this.baseDir, 'metadata_index.json');
            this.categoriesPath = path.join(this.baseDir, 'categories.json');

            // Ensure base dir exists
            if (!fs.existsSync(this.baseDir)) {
                fs.mkdirSync(this.baseDir, { recursive: true });
            }

            // Ensure metadata index file exists
            if (!fs.existsSync(this.indexPath)) {
                fs.writeFileSync(this.indexPath, JSON.stringify([], null, 2), 'utf8');
            }

            // Ensure custom categories file exists
            if (!fs.existsSync(this.categoriesPath)) {
                const defaultCategories = [
                    'Samsung Appliances',
                    'Samsung TV',
                    'SmartThings Camera',
                    'Lighting & Switches',
                    'Sensors',
                    'Other Partner Devices'
                ];
                fs.writeFileSync(this.categoriesPath, JSON.stringify(defaultCategories, null, 2), 'utf8');
            }

            this.initialized = true;
            console.log(`[ST-Presentation] DB initialized at: ${this.baseDir}`);
        } catch (error) {
            console.error('[ST-Presentation] Initialization failed:', error);
        }
    }

    /**
     * Safe string for filename
     */
    getSafeFilename(manufacturer, presentationId) {
        const safeMfg = manufacturer.replace(/[^a-zA-Z0-9]/g, '_');
        const safeId = presentationId.replace(/[^a-zA-Z0-9\-]/g, '_');
        return `${safeMfg}__${safeId}.json`;
    }

    /**
     * Read the metadata index file
     */
    async getIndex() {
        await this.ensureInitialized();
        try {
            const content = await fs.promises.readFile(this.indexPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('[ST-Presentation] Failed to read metadata index:', error);
            return [];
        }
    }

    /**
     * Write to metadata index file
     */
    async saveIndex(indexData) {
        await this.ensureInitialized();
        try {
            await fs.promises.writeFile(this.indexPath, JSON.stringify(indexData, null, 2), 'utf8');
        } catch (error) {
            console.error('[ST-Presentation] Failed to write metadata index:', error);
            throw error;
        }
    }

    /**
     * Get categories list
     */
    async getCategories() {
        await this.ensureInitialized();
        try {
            const content = await fs.promises.readFile(this.categoriesPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('[ST-Presentation] Failed to read categories:', error);
            return [];
        }
    }

    /**
     * Save categories list
     */
    async saveCategories(categories) {
        await this.ensureInitialized();
        try {
            await fs.promises.writeFile(this.categoriesPath, JSON.stringify(categories, null, 2), 'utf8');
            return categories;
        } catch (error) {
            console.error('[ST-Presentation] Failed to write categories:', error);
            throw error;
        }
    }

    /**
     * Extract capabilities and components from raw JSON
     */
    extractSchemaMeta(presentationObj) {
        const capabilities = new Set();
        const components = new Set();

        // 1. Scan Dashboard States & Actions
        if (presentationObj.dashboard) {
            const states = presentationObj.dashboard.states || [];
            states.forEach(s => {
                if (s.capability) capabilities.add(s.capability);
                if (s.component) components.add(s.component);
            });

            const actions = presentationObj.dashboard.actions || [];
            actions.forEach(a => {
                if (a.capability) capabilities.add(a.capability);
                if (a.component) components.add(a.component);
            });
        }

        // 2. Scan Detail View
        const detailView = presentationObj.detailView || [];
        detailView.forEach(d => {
            if (d.capability) capabilities.add(d.capability);
            if (d.component) components.add(d.component);
        });

        // 3. Scan Automation
        if (presentationObj.automation) {
            const conds = presentationObj.automation.conditions || [];
            conds.forEach(c => {
                if (c.capability) capabilities.add(c.capability);
                if (c.component) components.add(c.component);
            });

            const acts = presentationObj.automation.actions || [];
            acts.forEach(a => {
                if (a.capability) capabilities.add(a.capability);
                if (a.component) components.add(a.component);
            });
        }

        return {
            capabilities: Array.from(capabilities),
            components: Array.from(components)
        };
    }

    /**
     * Import / Save a Presentation JSON
     */
    async savePresentation(jsonText, customName, categories = []) {
        await this.ensureInitialized();
        let presentationObj;
        try {
            presentationObj = JSON.parse(jsonText);
        } catch (e) {
            throw new Error(`Invalid JSON format: ${e.message}`);
        }

        const presentationId = presentationObj.presentationId;
        const manufacturerName = presentationObj.manufacturerName;

        if (!presentationId || !manufacturerName) {
            throw new Error('Missing required fields: "presentationId" and "manufacturerName" in JSON.');
        }

        // Parse capabilities and components
        const { capabilities, components } = this.extractSchemaMeta(presentationObj);

        // Save detailed JSON file
        const fileName = this.getSafeFilename(manufacturerName, presentationId);
        const filePath = path.join(this.baseDir, fileName);
        await fs.promises.writeFile(filePath, JSON.stringify(presentationObj, null, 2), 'utf8');

        // Update metadata index
        const index = await this.getIndex();
        const existingIdx = index.findIndex(item => item.presentationId === presentationId);

        const newMeta = {
            presentationId,
            manufacturerName,
            customName: customName || presentationId,
            categories: Array.isArray(categories) ? categories : [],
            capabilities,
            components,
            createdAt: new Date().toISOString(),
            fileName
        };

        if (existingIdx >= 0) {
            // Keep original customName if none provided
            if (!customName) {
                newMeta.customName = index[existingIdx].customName;
            }
            index[existingIdx] = { ...index[existingIdx], ...newMeta };
        } else {
            index.push(newMeta);
        }

        await this.saveIndex(index);
        console.log(`[ST-Presentation] Saved presentation: ${presentationId} by ${manufacturerName}`);
        return { success: true, meta: newMeta };
    }

    /**
     * Get details of a single presentation
     */
    async getPresentationDetail(fileName) {
        await this.ensureInitialized();
        const filePath = path.join(this.baseDir, fileName);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Presentation file ${fileName} not found.`);
        }
        const content = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Delete presentation
     */
    async deletePresentation(presentationId, fileName) {
        await this.ensureInitialized();
        
        // Delete JSON file
        const filePath = path.join(this.baseDir, fileName);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }

        // Update index
        const index = await this.getIndex();
        const filteredIndex = index.filter(item => item.presentationId !== presentationId);
        await this.saveIndex(filteredIndex);

        console.log(`[ST-Presentation] Deleted presentation: ${presentationId}`);
        return { success: true };
    }

    /**
     * Advanced Search (Async and multi-word full-text capability)
     */
    async searchPresentations({ query, searchType = 'all', categories = [], capability = '' }) {
        await this.ensureInitialized();
        const index = await this.getIndex();
        
        // Clean filters
        let results = [...index];

        // 1. Filter by Category
        if (categories && categories.length > 0) {
            results = results.filter(item => 
                item.categories && item.categories.some(cat => categories.includes(cat))
            );
        }

        // 2. Filter by Capability
        if (capability) {
            const capLower = capability.toLowerCase();
            results = results.filter(item => 
                item.capabilities && item.capabilities.some(cap => cap.toLowerCase().includes(capLower))
            );
        }

        // 3. Filter by Query (Name or Content)
        if (query && query.trim()) {
            const keywords = query.trim().toLowerCase().split(/\s+/); // Multi-word support
            
            if (searchType === 'name') {
                // Search only in CustomName, PresentationId, ManufacturerName
                results = results.filter(item => {
                    const nameFields = [
                        item.customName,
                        item.presentationId,
                        item.manufacturerName
                    ].map(f => (f || '').toLowerCase());

                    // All keywords must be contained in at least one of the name fields
                    return keywords.every(kw => 
                        nameFields.some(field => field.includes(kw))
                    );
                });
            } else {
                // Search both name fields AND full-text content of the JSON files
                const matchedResults = [];
                
                // Read files asynchronously with concurrency limits to avoid blocking
                const batchSize = 10;
                for (let i = 0; i < results.length; i += batchSize) {
                    const batch = results.slice(i, i + batchSize);
                    
                    const batchPromises = batch.map(async (item) => {
                        // Check name fields first (fast shortcut)
                        const nameFields = [
                            item.customName,
                            item.presentationId,
                            item.manufacturerName
                        ].map(f => (f || '').toLowerCase());
                        
                        const nameMatchesAll = keywords.every(kw => 
                            nameFields.some(field => field.includes(kw))
                        );

                        if (nameMatchesAll) {
                            return { match: true, item };
                        }

                        // Fallback: search within file contents
                        try {
                            const filePath = path.join(this.baseDir, item.fileName);
                            const fileContent = await fs.promises.readFile(filePath, 'utf8');
                            const contentLower = fileContent.toLowerCase();

                            // All keywords must be contained in the full-text content
                            const contentMatchesAll = keywords.every(kw => contentLower.includes(kw));
                            return { match: contentMatchesAll, item };
                        } catch (e) {
                            console.error(`[ST-Presentation] Failed to read ${item.fileName} during search:`, e);
                            return { match: false, item };
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    batchResults.forEach(res => {
                        if (res.match) {
                            matchedResults.push(res.item);
                        }
                    });
                }
                
                results = matchedResults;
            }
        }

        return results;
    }

    /**
     * Bind socket event listeners
     */
    initSocket(socket) {
        socket.on('st_presentation_save', async ({ jsonText, customName, categories }) => {
            try {
                const result = await this.savePresentation(jsonText, customName, categories);
                const updatedList = await this.getIndex();
                socket.emit('st_presentation_save_result', { success: true, meta: result.meta, list: updatedList });
            } catch (error) {
                socket.emit('st_presentation_save_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_list', async () => {
            try {
                const list = await this.getIndex();
                const categories = await this.getCategories();
                socket.emit('st_presentation_list_result', { success: true, list, categories });
            } catch (error) {
                socket.emit('st_presentation_list_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_delete', async ({ presentationId, fileName }) => {
            try {
                await this.deletePresentation(presentationId, fileName);
                const updatedList = await this.getIndex();
                socket.emit('st_presentation_delete_result', { success: true, list: updatedList });
            } catch (error) {
                socket.emit('st_presentation_delete_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_search', async (searchParams) => {
            try {
                const results = await this.searchPresentations(searchParams);
                socket.emit('st_presentation_search_result', { success: true, results });
            } catch (error) {
                socket.emit('st_presentation_search_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_get_detail', async ({ fileName }) => {
            try {
                const detail = await this.getPresentationDetail(fileName);
                socket.emit('st_presentation_get_detail_result', { success: true, detail });
            } catch (error) {
                socket.emit('st_presentation_get_detail_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_update_categories_list', async ({ categoriesList }) => {
            try {
                const saved = await this.saveCategories(categoriesList);
                socket.emit('st_presentation_update_categories_list_result', { success: true, categories: saved });
            } catch (error) {
                socket.emit('st_presentation_update_categories_list_result', { success: false, message: error.message });
            }
        });

        socket.on('st_presentation_update_category', async ({ presentationId, categories }) => {
            try {
                const index = await this.getIndex();
                const targetIdx = index.findIndex(item => item.presentationId === presentationId);
                if (targetIdx >= 0) {
                    index[targetIdx].categories = Array.isArray(categories) ? categories : [];
                    await this.saveIndex(index);
                    socket.emit('st_presentation_update_category_result', { success: true, list: index });
                } else {
                    throw new Error('Target presentation not found.');
                }
            } catch (error) {
                socket.emit('st_presentation_update_category_result', { success: false, message: error.message });
            }
        });
    }
}

module.exports = new STPresentationService();
