
socket.on('list_sdb_devices', ({ sdbPath } = {}) => {
    console.log('[SDB] Listing devices...');
    const cmd = `${getSdbCmd(sdbPath)} devices`;

    // Handle Windows encoding if necessary
    const fullCmd = process.platform === 'win32' ? `chcp 65001 > nul && ${cmd}` : cmd;

    exec(fullCmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
            console.error('[SDB] List devices failed:', error.message);
            // Emit empty list on error
            socket.emit('sdb_devices', []);
            return;
        }

        // Parse lines
        // Output format:
        // List of devices attached 
        // 192.168.250.250:26101	device	my_tv
        const lines = (stdout || '').split('\n');
        const devices = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('List of devices')) continue;
            if (trimmed.startsWith('*')) continue; // daemon start logs etc
            if (trimmed.includes('Active code page')) continue; // chcp output

            // Split by whitespace
            // ID  STATUS  NAME(Optional)
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 1) {
                // Sometimes just ID usually ID STATUS
                const id = parts[0];
                const type = parts.length > 1 ? parts[1] : 'unknown';

                // Filter out garbage lines that don't look like IP:Port or Serial
                if (id.includes('.') || id.length > 5) {
                    devices.push({ id, type });
                }
            }
        }
        console.log(`[SDB] Found ${devices.length} devices`);
        socket.emit('sdb_devices', devices);
    });
});
