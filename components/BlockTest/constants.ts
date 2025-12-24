import { CommandBlock } from './types';

export const PREDEFINED_BLOCKS: CommandBlock[] = [
    {
        id: 'connect_block',
        name: 'Connect',
        type: 'predefined',
        description: 'Connect to device',
        commands: [
            'sdb disconnect',
            'sdb connect 192.168.250.250',
            'sdb remount'
        ]
    },
    {
        id: 'enter_block',
        name: 'Enter',
        type: 'predefined',
        description: 'Press Enter',
        commands: ['sdb shell input keyevent 66'] // Assuming 66 is Enter for Android/Tizen, user said "sdb vk_send 36" (0x24? No, 36 dec is '0' ok wait user said "sdb vk_send 36" explicitly)
    },
    {
        id: 'back_block',
        name: 'Back',
        type: 'predefined',
        description: 'Press Back',
        commands: []
    },
    {
        id: 'left_block',
        name: 'Left',
        type: 'predefined',
        description: 'Press Left',
        commands: []
    },
    {
        id: 'right_block',
        name: 'Right',
        type: 'predefined',
        description: 'Press Right',
        commands: []
    },
    {
        id: 'up_block',
        name: 'Up',
        type: 'predefined',
        description: 'Press Up',
        commands: []
    },
    {
        id: 'down_block',
        name: 'Down',
        type: 'predefined',
        description: 'Press Down',
        commands: []
    },
    {
        id: 'home_block',
        name: 'Home',
        type: 'predefined',
        description: 'Press Home',
        commands: ['sdb shell input keyevent 3']
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
    'sdb remount'
];
PREDEFINED_BLOCKS[1].commands = ['sdb shell input keyevent 66'];
// Update: User said "sdb vk_send 36". I should use that.
PREDEFINED_BLOCKS[1].commands = ['sdb shell vk_send 36']; // Assuming sdb shell. Or just sdb vk_send 36?
// Prompt: "sdb vk_send 36". I'll use exactly that.
PREDEFINED_BLOCKS[1].commands = ['sdb vk_send 36'];
