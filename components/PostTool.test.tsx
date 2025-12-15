import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PostTool from './PostTool'; // Ensure it's imported from the right place relative to this test file being in components/
import { SavedRequest, PostGlobalVariable } from '../types';

// Mock dependencies
vi.mock('./PostTool/RequestSidebar', () => ({
    default: ({ savedRequests, onSelectRequest }: any) => (
        <div data-testid="sidebar">
            {savedRequests.map((req: any) => (
                <button
                    key={req.id}
                    data-testid={`select-${req.id}`}
                    onClick={() => onSelectRequest(req.id)}
                >
                    Select {req.name}
                </button>
            ))}
        </div>
    )
}));

vi.mock('./PostTool/RequestEditor', () => ({
    default: ({ currentRequest, onSend }: any) => (
        <div data-testid="editor">
            <button onClick={onSend} data-testid="send-btn">Send</button>
            <div data-testid="current-url">{currentRequest.url}</div>
        </div>
    )
}));

vi.mock('./PostTool/EnvironmentModal', () => ({
    default: () => <div data-testid="env-modal">Modal</div>
}));

vi.mock('./PostTool/ResponseViewer', () => ({
    default: () => <div data-testid="response">Response</div>
}));

// Mock fetch explicitly
global.fetch = vi.fn();

describe('PostTool Integration', () => {
    it('performs variable substitution correctly (URL and Headers)', async () => {
        const onUpdateRequests = vi.fn();
        const globalVariables: PostGlobalVariable[] = [
            { id: '1', key: 'host', value: 'https://api.example.com', enabled: true },
            { id: '2', key: 'token', value: '12345', enabled: true }
        ];

        const requests: SavedRequest[] = [{
            id: 'r1', name: 'R1', method: 'GET', url: '{{host}}/v1',
            headers: [{ key: 'Auth', value: '{{token}}' }, { key: '', value: '' }],
            body: '{{token}}',
            groupId: 'g1'
        }];

        vi.mocked(global.fetch).mockResolvedValue({
            status: 200, statusText: 'OK', headers: new Headers(),
            text: () => Promise.resolve('{}'),
            json: () => Promise.resolve({})
        } as Response);

        const { getByTestId } = render(
            <PostTool
                savedRequests={requests}
                onUpdateRequests={onUpdateRequests}
                globalVariables={globalVariables}
            />
        );

        // 1. Select the request
        fireEvent.click(getByTestId('select-r1'));

        // 2. Click Send
        fireEvent.click(getByTestId('send-btn'));

        // 3. Verify fetch call
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = vi.mocked(global.fetch).mock.calls[0];

        expect(url).toBe('https://api.example.com/v1');
        const headers = options?.headers as Record<string, string>;
        expect(headers['Auth']).toBe('12345');
    });

    it('substitutes body variables for POST requests', async () => {
        const onUpdateRequests = vi.fn();
        const globalVariables: PostGlobalVariable[] = [{ id: '1', key: 'id', value: '999', enabled: true }];
        const requests: SavedRequest[] = [{
            id: 'r2', name: 'R2', method: 'POST', url: 'http://test.com',
            headers: [{ key: '', value: '' }],
            body: '{"user": {{id}}}',
            groupId: 'g1'
        }];

        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({
            status: 200, statusText: 'OK', headers: new Headers(),
            text: () => Promise.resolve('{}'),
            json: () => Promise.resolve({})
        } as Response);

        const { getByTestId } = render(
            <PostTool
                savedRequests={requests}
                onUpdateRequests={onUpdateRequests}
                globalVariables={globalVariables}
            />
        );

        fireEvent.click(getByTestId('select-r2'));
        fireEvent.click(getByTestId('send-btn'));

        const [url, options] = vi.mocked(global.fetch).mock.calls[0];
        expect(options?.body).toBe('{"user": 999}');
    });
});
