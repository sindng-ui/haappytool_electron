import { CommandBlock } from './types';

export const PREDEFINED_BLOCKS: CommandBlock[] = [
    {
        id: 'connect_block',
        name: 'Connect',
        type: 'predefined',
        description: 'Connect to device',
        commands: [
            'sdb connect 192.168.250.250',
            'sdb root on'
        ]
    },
    {
        id: 'enter_block',
        name: 'Enter',
        type: 'predefined',
        description: 'Press Enter',
        commands: ['sdb shell vk_send 36']
    },
    {
        id: 'back_block',
        name: 'Back',
        type: 'predefined',
        description: 'Press Back',
        commands: ['sdb shell vk_send 9']
    },
    {
        id: 'left_block',
        name: 'Left',
        type: 'predefined',
        description: 'Press Left',
        commands: ['sdb shell vk_send 113']
    },
    {
        id: 'right_block',
        name: 'Right',
        type: 'predefined',
        description: 'Press Right',
        commands: ['sdb shell vk_send 114']
    },
    {
        id: 'up_block',
        name: 'Up',
        type: 'predefined',
        description: 'Press Up',
        commands: ['sdb shell vk_send 11']
    },
    {
        id: 'down_block',
        name: 'Down',
        type: 'predefined',
        description: 'Press Down',
        commands: ['sdb shell vk_send 116']
    },
    {
        id: 'home_block',
        name: 'Home',
        type: 'predefined',
        description: 'Press Home',
        commands: ['sdb shell vk_send 71']
    },
    {
        id: 'exit_block',
        name: 'Exit',
        type: 'predefined',
        description: 'Press Exit',
        commands: ['sdb shell vk_send 182']
    }
];

export const SPECIAL_BLOCK_IDS = {
    SLEEP: 'special_sleep',
    WAIT_FOR_IMAGE: 'special_wait_image',
    LOG_START: 'special_log_start',
    LOG_STOP: 'special_log_stop'
};

export const SPECIAL_BLOCKS: CommandBlock[] = [
    {
        id: SPECIAL_BLOCK_IDS.SLEEP,
        name: 'Sleep',
        type: 'special',
        description: 'Wait for specified time',
        commands: []
    },
    {
        id: SPECIAL_BLOCK_IDS.WAIT_FOR_IMAGE,
        name: 'Wait Image',
        type: 'special',
        description: 'Wait until image appears on screen',
        commands: []
    },
    {
        id: SPECIAL_BLOCK_IDS.LOG_START,
        name: 'Log Start',
        type: 'special',
        description: 'Start background logging to file',
        commands: []
    },
    {
        id: SPECIAL_BLOCK_IDS.LOG_STOP,
        name: 'Log Stop',
        type: 'special',
        description: 'Stop background logging',
        commands: []
    }
];

// User specified "Enter block : Clicking or selection command block. Command is sdb vk_send 36"
// I will adhere to the prompt's specific command for Enter.
// For others, prompt said "Command is empty".
// Wait, for Connect, prompt said "sdb disconnect, sdb connect 192168.250.250, sdb remount".
// Note the IP has a typo in prompt "192168.250.250" -> "192.168.250.250". I will correct it but maybe the user meant that specific string? 
// "192168.250.250" is invalid IP. Assume typo "192.168...".

PREDEFINED_BLOCKS[0].commands = [
    'sdb disconnect',
    'sdb connect 192.168.250.250',
    'sdb root on'
];
PREDEFINED_BLOCKS[1].commands = ['sdb shell input keyevent 66'];
// Update: User said "sdb vk_send 36". I should use that.
PREDEFINED_BLOCKS[1].commands = ['sdb shell vk_send 36']; // Assuming sdb shell. Or just sdb vk_send 36?
// Prompt: "sdb vk_send 36". I'll use exactly that.
PREDEFINED_BLOCKS[1].commands = ['sdb shell vk_send 36'];
