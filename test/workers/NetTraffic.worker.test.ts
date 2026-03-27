import { describe, it, expect, beforeEach } from 'vitest';
import { 
  normalizeUri, 
  extractHost, 
  detectMethod, 
  extractBucket, 
  templateToRegex, 
  processLine,
  setPatterns,
  setUAPattern,
  resetInternalState,
  patterns // 🐧 Added back
} from '../../workers/NetTraffic.worker';

describe('NetTraffic.worker (Log Analysis Engine)', () => {
  
  beforeEach(() => {
    resetInternalState();
  });

  describe('normalizeUri', () => {
    it('should replace UUID with $(UUID)', () => {
      const uri = 'https://api.test.com/v1/user/12345678-1234-1234-1234-1234567890ab/profile';
      expect(normalizeUri(uri)).toBe('https://api.test.com/v1/user/$(UUID)/profile');
    });

    it('should handle multiple UUIDs in a single URI', () => {
      const uri = '/resource/12345678-1234-1234-1234-1234567890ab/sub/abcdef12-abcd-abcd-abcd-abcdef123456';
      expect(normalizeUri(uri)).toBe('/resource/$(UUID)/sub/$(UUID)');
    });

    it('should trim surrounding whitespace', () => {
      expect(normalizeUri('  /test  ')).toBe('/test');
    });
  });

  describe('extractHost', () => {
    it('should extract host from http/https URIs', () => {
      expect(extractHost('https://google.com/search')).toBe('google.com');
      expect(extractHost('http://localhost:3000/api')).toBe('localhost:3000');
    });

    it('should return unknown for relative paths', () => {
      expect(extractHost('/api/v1/test')).toBe('unknown');
    });
  });

  describe('detectMethod', () => {
    it('should detect standard HTTP methods', () => {
      expect(detectMethod('INFO: GET /index.html')).toBe('GET');
      expect(detectMethod('2026-03-27 POST> /api/data')).toBe('POST');
      expect(detectMethod('PUT /resource')).toBe('PUT');
    });

    it('should return null if no method is found', () => {
      expect(detectMethod('Just a random log line')).toBeNull();
    });
  });

  describe('extractBucket', () => {
    it('should extract HH:mm from HH:mm:ss format', () => {
      expect(extractBucket('12:34:56.789 I/TAG: Log')).toBe('12:34');
    });

    it('should convert seconds to minutes (e.g., 065.123 -> 1m)', () => {
      expect(extractBucket('065.123 I/TAG: Log')).toBe('1m');
      expect(extractBucket('125.000 I/TAG: Log')).toBe('2m');
    });
  });

  describe('templateToRegex', () => {
    it('should convert template with $(id) to named capture groups', () => {
      const template = 'User agent: $(ClientName)/$(Version)';
      const regex = templateToRegex(template);
      expect(regex).not.toBeNull();
      
      const line = 'User agent: MyApp/1.2.3';
      const match = line.match(regex!);
      expect(match?.groups?.ClientName).toBe('MyApp');
      expect(match?.groups?.Version).toBe('1.2.3');
    });

    it('should escape special regex characters and handle literal parentheses', () => {
      const template = 'API [$(Method)] (v$(Ver)) /users/$(id).json';
      const regex = templateToRegex(template);
      expect(regex).not.toBeNull();
      
      const line = 'API [GET] (v1.2) /users/1234.json';
      const match = line.match(regex!);
      expect(match?.groups?.Method).toBe('GET');
      expect(match?.groups?.Ver).toBe('1.2');
      expect(match?.groups?.id).toBe('1234');
    });
  });

  describe('processLine (Integration)', () => {
    
    it('should match keywords and extract URIs with UA clustering', () => {
      setPatterns([{ id: 'p1', alias: 'API', keywords: 'HTTP_LOG', extractRegex: '', enabled: true }]);
      setUAPattern({
        keywords: 'User-Agent',
        template: 'User-Agent: $(Browser)/$(Ver)',
        enabled: true
      });

      const stats = new Map();
      const uaMap = new Map();
      const insights = { timeline: new Map(), hosts: new Map(), methods: new Map(), totalRequests: 0 };
      
      // 1. Set UA
      processLine('User-Agent: Chrome/120', stats, uaMap, insights, 0);
      
      // 2. Process Traffic
      const line = 'HTTP_LOG: GET https://api.site.com/v1/data';
      processLine(line, stats, uaMap, insights, 1);
      
      // Debug: If failed, show patterns
      if (insights.totalRequests === 0) {
        throw new Error(`insights.totalRequests is 0. Patterns count: ${patterns.length}, Content: ${JSON.stringify(patterns)}`);
      }

      expect(insights.totalRequests).toBe(1);
      expect(insights.hosts.get('api.site.com')).toBe(1);
      expect(insights.methods.get('GET')).toBe(1);
      // Check UA clustering
      // 🐧 팁: JSON.stringify는 키 순서에 의존적이므로, 실제 데이터 구조를 직접 순회하며 검증하는 것이 더 안전합니다.
      const uaEntries = Array.from(uaMap.values());
      const chromeUA = uaEntries.find(e => e.variables.Browser === 'Chrome' && e.variables.Ver === '120');
      
      expect(chromeUA).toBeDefined();
      expect(chromeUA?.count).toBe(1);
      expect(chromeUA?.endpointStats.has('https://api.site.com/v1/data')).toBe(true);
    });

    it('should handle multi-keyword AND matching', () => {
      setPatterns([{ id: 'p1', alias: 'Strict', keywords: 'REQ, AUTH', extractRegex: '', enabled: true }]);
      
      const stats = new Map();
      const uaMap = new Map();
      const insights = { timeline: new Map(), hosts: new Map(), methods: new Map(), totalRequests: 0 };

      processLine('REQ other AUTH: /test', stats, uaMap, insights, 0);
      expect(insights.totalRequests).toBe(1);
    });

    it('should handle [LOG] hit when no URI is found', () => {
      setPatterns([{ id: 'p1', alias: 'API', keywords: 'HTTP_LOG', extractRegex: '', enabled: true }]);
      
      const stats = new Map();
      const uaMap = new Map();
      const insights = { timeline: new Map(), hosts: new Map(), methods: new Map(), totalRequests: 0 };

      processLine('HTTP_LOG: Something happened without a URI', stats, uaMap, insights, 0);
      
      expect(insights.totalRequests).toBe(1);
      expect(stats.has('[LOG] API')).toBe(true);
    });
  });
});
