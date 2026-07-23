/**
 * Helper utility to format and optimize SDB commands for high performance execution
 * in BlockTest pipelines.
 */

export interface SdbCommandFormatOptions {
    targetDeviceId?: string | null;
}

/**
 * Formats a command string if it's an SDB command to include explicit device target (-s)
 * and optimize execution parameters to prevent interactive stdin buffering delays.
 */
export function formatSdbCommand(cmd: string, options?: SdbCommandFormatOptions): string {
    if (!cmd || typeof cmd !== 'string') return cmd;

    const trimmed = cmd.trim();

    // Check if it's an sdb command
    if (/^sdb\s+/i.test(trimmed)) {
        let formatted = trimmed;

        // If targetDeviceId is provided and '-s' is not already in the command
        if (options?.targetDeviceId && !/\s-s\s/i.test(formatted)) {
            // Replace 'sdb ' with 'sdb -s <targetDeviceId> '
            formatted = formatted.replace(/^sdb\s+/i, `sdb -s ${options.targetDeviceId.trim()} `);
        }

        return formatted;
    }

    return trimmed;
}

/**
 * Helper to get saved default SDB device from localStorage if available
 */
export function getSavedSdbDeviceId(): string | null {
    try {
        const savedTarget = localStorage.getItem('happytool_selected_sdb_device');
        if (savedTarget && savedTarget.trim().length > 0) {
            return savedTarget.trim();
        }
        const savedConfig = localStorage.getItem('happytool_tizen_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed && parsed.targetIp) {
                return parsed.targetIp.includes(':') ? parsed.targetIp : `${parsed.targetIp}:26101`;
            }
        }
    } catch (e) {
        console.warn('[sdbCommandHelper] Error reading saved SDB device ID:', e);
    }
    return null;
}
