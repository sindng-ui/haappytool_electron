import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PostTool from './PostTool';
import { SavedRequest, PostGlobalVariable } from '../types';
import * as HappyToolContext from '../contexts/HappyToolContext';

// Mock dependencies
vi.mock('./PostTool/RequestSidebar', () => ({
    default: ({ savedRequests, onSelectRequest, onNewRequest, onDuplicateRequest }: any) => (
        <div data-testid="sidebar">
            <button data-testid="new-req-btn" onClick={() => onNewRequest()}>New Request</button>
            {savedRequests.map((req: any) => (
                <div key={req.id}>
                    <button
                        data-testid={`select-${req.id}`}
                        onClick={() => onSelectRequest(req.id)}
                    >
                        Select {req.name}
                    </button>
                    <button
                        data-testid={`duplicate-${req.id}`}
                        onClick={(e) => onDuplicateRequest(e, req)}
                    >
                        Duplicate {req.name}
                    </button>
                </div>
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

// Mock Context
const useHappyToolMock = vi.fn();
vi.mock('../contexts/HappyToolContext', () => ({
    useHappyTool: () => useHappyToolMock()
}));

// Mock fetch explicitly
global.fetch = vi.fn();

describe('PostTool Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

        useHappyToolMock.mockReturnValue({
            savedRequests: requests,
            setSavedRequests: onUpdateRequests,
            savedRequestGroups: [],
            setSavedRequestGroups: vi.fn(),
            postGlobalVariables: globalVariables,
            setPostGlobalVariables: vi.fn(),
        });

        vi.mocked(global.fetch).mockResolvedValue({
            status: 200, statusText: 'OK', headers: new Headers(),
            text: () => Promise.resolve('{}'),
            json: () => Promise.resolve({})
        } as Response);

        const { getByTestId } = render(<PostTool />);

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

        useHappyToolMock.mockReturnValue({
            savedRequests: requests,
            setSavedRequests: onUpdateRequests,
            savedRequestGroups: [],
            setSavedRequestGroups: vi.fn(),
            postGlobalVariables: globalVariables,
            setPostGlobalVariables: vi.fn(),
        });

        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({
            status: 200, statusText: 'OK', headers: new Headers(),
            text: () => Promise.resolve('{}'),
            json: () => Promise.resolve({})
        } as Response);

        const { getByTestId } = render(<PostTool />);

        fireEvent.click(getByTestId('select-r2'));
        fireEvent.click(getByTestId('send-btn'));

        const [url, options] = vi.mocked(global.fetch).mock.calls[0];
        expect(options?.body).toBe('{"user": 999}');
    });

    it('creates new request with default headers', () => {
        const onUpdateRequests = vi.fn();
        const requests: SavedRequest[] = [];

        useHappyToolMock.mockReturnValue({
            savedRequests: requests,
            setSavedRequests: onUpdateRequests,
            savedRequestGroups: [],
            setSavedRequestGroups: vi.fn(),
            postGlobalVariables: [],
            setPostGlobalVariables: vi.fn(),
        });

        const { getByTestId } = render(<PostTool />);

        fireEvent.click(getByTestId('new-req-btn'));

        expect(onUpdateRequests).toHaveBeenCalled();
        const newReqs = onUpdateRequests.mock.calls[0][0];
        expect(newReqs).toHaveLength(1);
        const newReq = newReqs[0];
        expect(newReq.name).toBe('New Request');
        expect(newReq.headers).toEqual([
            { key: 'Authorization', value: 'Bearer ' },
            { key: 'Accept', value: 'application/json' },
            { key: '', value: '' }
        ]);
    });

    it('duplicates request correctly', () => {
        const onUpdateRequests = vi.fn();
        const requests: SavedRequest[] = [{
            id: 'r1', name: 'Original', method: 'GET', url: 'http://test.com',
            headers: [{ key: 'Foo', value: 'Bar' }],
            body: '',
            groupId: 'g1'
        }];

        useHappyToolMock.mockReturnValue({
            savedRequests: requests,
            setSavedRequests: onUpdateRequests,
            savedRequestGroups: [],
            setSavedRequestGroups: vi.fn(),
            postGlobalVariables: [],
            setPostGlobalVariables: vi.fn(),
        });

        const { getByTestId } = render(<PostTool />);

        fireEvent.click(getByTestId('duplicate-r1'));

        expect(onUpdateRequests).toHaveBeenCalled();
        const newReqs = onUpdateRequests.mock.calls[0][0];
        expect(newReqs).toHaveLength(2); // Original + Copy
        const copy = newReqs[1];
        expect(copy.name).toBe('Original Copy');
        expect(copy.headers).toEqual([{ key: 'Foo', value: 'Bar' }]);
        expect(copy.groupId).toBe('g1');
        expect(copy.id).not.toBe('r1');
    });
});
