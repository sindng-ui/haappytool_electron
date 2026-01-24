export interface STLocation {
    locationId: string;
    name: string;
    description?: string;
    backgroundImage?: string;
    timeZoneId?: string;
    background?: any;
}

export interface STRoom {
    roomId: string;
    locationId: string;
    name: string;
    backgroundImage?: string;
}

export interface STDevice {
    deviceId: string;
    name: string;
    label?: string;
    manufacturerName?: string;
    presentationId?: string;
    locationId?: string;
    roomId?: string;
    components?: STComponent[];
    createTime?: string;
    profile?: {
        id: string;
    };
    type?: string;
    dth?: any;
    viper?: any;
}

export interface STComponent {
    id: string;
    label?: string;
    capabilities: STCapabilityRef[];
    categories?: {
        name: string;
        categoryType?: string;
    }[];
}

export interface STCapabilityRef {
    id: string;
    version?: number;
}

export interface STCapability {
    id: string;
    version: number;
    status: 'proposed' | 'live' | 'deprecated' | 'dead';
    name: string;
    attributes: Record<string, STAttribute>;
    commands: Record<string, STCommand>;
}

export interface STAttribute {
    schema: {
        type: string;
        properties?: any;
        additionalProperties?: boolean;
        required?: string[];
        enum?: string[];
    };
    enumCommands?: any[];
}

export interface STCommand {
    name: string;
    arguments: STCommandArgument[];
}

export interface STCommandArgument {
    name: string;
    optional?: boolean;
    schema: {
        type: string;
        min?: number;
        max?: number;
        enum?: string[];
    };
}

export interface STDeviceStatus {
    components: Record<string, Record<string, Record<string, STAttributeStatus>>>;
}

export interface STAttributeStatus {
    value: any;
    unit?: string;
    data?: any;
    timestamp?: string;
}

export interface STCommandRequest {
    component: string;
    capability: string;
    command: string;
    arguments?: any[];
}
