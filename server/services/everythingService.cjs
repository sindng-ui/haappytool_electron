const { spawn } = require('child_process');
const http = require('http');

/**
 * Everything Search Service
 * Handles communication with Everything (voidtools) via HTTP API or CLI.
 */
class EverythingService {
    constructor() {
        this.config = {
            host: '127.0.0.1',
            port: 8080, // Default Everything HTTP port
            useHttp: true,
            cliPath: 'es.exe', // Make sure es.exe is in PATH or specify full path
        };
    }

    /**
     * Set service configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Search files/folders
     * @param {string} query Search query
     * @param {object} options Search options (offset, count, etc.)
     */
    async search(query, options = {}) {
        if (this.config.useHttp) {
            return this.searchViaHttp(query, options);
        } else {
            return this.searchViaCli(query, options);
        }
    }

    /**
     * Search via Everything HTTP Server (JSON API)
     */
    searchViaHttp(query, options = {}) {
        return new Promise((resolve, reject) => {
            const { offset = 0, count = 100 } = options;
            const url = `http://${this.config.host}:${this.config.port}/?search=${encodeURIComponent(query)}&json=1&offset=${offset}&count=${count}&path_column=1&size_column=1&date_modified_column=1`;

            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({
                            total: json.total_results || 0,
                            items: (json.results || []).map(item => ({
                                name: item.name,
                                path: item.path,
                                fullPath: `${item.path}\\${item.name}`,
                                type: item.type, // 'file' or 'folder'
                                size: item.size,
                                dateModified: item.date_modified
                            }))
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse Everything response: ${e.message}`));
                    }
                });
            }).on('error', (err) => {
                reject(new Error(`Everything HTTP request failed: ${err.message}. (Is HTTP Server enabled in Everything?)`));
            });
        });
    }

    /**
     * Search via es.exe (CLI) - Fallback
     */
    searchViaCli(query, options = {}) {
        return new Promise((resolve, reject) => {
            // Basic CLI implementation - might be less efficient for giant result sets
            // es.exe -json -n 100 "query"
            const { count = 100 } = options;
            const args = ['-json', '-n', count.toString(), query];
            
            const proc = spawn(this.config.cliPath, args);
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data; });
            proc.stderr.on('data', (data) => { stderr += data; });

            proc.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`es.exe failed: ${stderr || 'Unknown error'}`));
                }
                try {
                    const json = JSON.parse(stdout);
                    resolve({
                        total: json.results?.length || 0,
                        items: (json.results || []).map(item => ({
                            name: item.name,
                            path: item.path,
                            fullPath: item.full_path,
                            type: item.type,
                            size: item.size,
                            dateModified: item.date_modified
                        }))
                    });
                } catch (e) {
                    reject(new Error(`Failed to parse es.exe output: ${e.message}`));
                }
            });
        });
    }

    /**
     * Initialize Socket.io events for Everything Search
     */
    initSocket(socket) {
        socket.on('everything_search', async ({ query, options }) => {
            try {
                const results = await this.search(query, options);
                socket.emit('everything_results', results);
            } catch (error) {
                socket.emit('everything_error', { message: error.message });
            }
        });

        socket.on('everything_update_config', (newConfig) => {
            this.updateConfig(newConfig);
            socket.emit('everything_config_updated', this.config);
        });

        // Add more interactions like "open file" if needed
        socket.on('everything_open_file', ({ fullPath }) => {
            // Using electron/node to open file
            const { exec } = require('child_process');
            exec(`explorer.exe /select,"${fullPath}"`);
        });
    }
}

module.exports = new EverythingService();
