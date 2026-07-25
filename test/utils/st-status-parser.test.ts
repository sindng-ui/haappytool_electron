import { describe, it, expect } from 'vitest';
import { parseDeviceStatus } from '../../components/PostTool/useSmartThingsDiscover';

describe('parseDeviceStatus helper', () => {
    it('parses switch state (on/off)', () => {
        const raw = {
            components: {
                main: {
                    switch: {
                        switch: { value: 'on' },
                    },
                },
            },
        };
        const summary = parseDeviceStatus(raw);
        expect(summary.switch).toBe('on');
    });

    it('parses temperature measurement and unit', () => {
        const raw = {
            components: {
                main: {
                    temperatureMeasurement: {
                        temperature: { value: 23.5, unit: 'C' },
                    },
                },
            },
        };
        const summary = parseDeviceStatus(raw);
        expect(summary.temperature).toBe(23.5);
        expect(summary.unit).toBe('C');
    });

    it('parses motion sensor state', () => {
        const raw = {
            components: {
                main: {
                    motionSensor: {
                        motion: { value: 'active' },
                    },
                },
            },
        };
        const summary = parseDeviceStatus(raw);
        expect(summary.motion).toBe('active');
    });

    it('returns rawStatus even if main component is missing', () => {
        const raw = { customField: 123 };
        const summary = parseDeviceStatus(raw);
        expect(summary.rawStatus).toEqual(raw);
        expect(summary.switch).toBeUndefined();
    });
});
