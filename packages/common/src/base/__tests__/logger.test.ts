import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';

// Mock the 'tslog' dependency
const mockAttachTransport = vi.fn();
const mockGetSubLogger = vi.fn();
vi.mock('tslog', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    attachTransport: mockAttachTransport,
    getSubLogger: mockGetSubLogger,
  })),
}));

describe('Logger Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules to force re-evaluation of logger.ts with new env variables
    vi.resetModules();
    vi.clearAllMocks();

    // Default to a non-VSCode environment for most tests
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_SERVER_PORT;
    delete process.env.VSCODE_CWD;
    delete process.env.POCHI_LOG;
    delete (globalThis as any).POCHI_LOG;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should create a sub-logger with default info level for Pochi', async () => {
    const { getLogger } = await import('../logger');
    getLogger('Pochi');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'Pochi', minLevel: 3 });
  });

  it('should create a sub-logger with default warn level for other names', async () => {
    const { getLogger } = await import('../logger');
    getLogger('OtherLogger');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'OtherLogger', minLevel: 4 });
  });

  it('should set minLevel to 0 in a VSCode environment', async () => {
    process.env.VSCODE_PID = '123'; // Simulate VSCode env
    const { getLogger } = await import('../logger');
    getLogger('AnyNameInVSCode');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'AnyNameInVSCode', minLevel: 0 });
  });

  it('should respect POCHI_LOG environment variable for simple level', async () => {
    process.env.POCHI_LOG = 'debug';
    const { getLogger } = await import('../logger');
    getLogger('AnyName');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'AnyName', minLevel: 2 });
  });

  it('should respect POCHI_LOG for pattern-based levels', async () => {
    process.env.POCHI_LOG = 'MyLogger=warn,Other=silly';
    const { getLogger } = await import('../logger');
    getLogger('MyLogger');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'MyLogger', minLevel: 4 });
    getLogger('Other');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'Other', minLevel: 0 });
  });

  it('should prioritize globalThis.POCHI_LOG over process.env', async () => {
    process.env.POCHI_LOG = 'info';
    (globalThis as any).POCHI_LOG = 'fatal';
    const { getLogger } = await import('../logger');
    getLogger('AnyName');
    expect(mockGetSubLogger).toHaveBeenCalledWith({ name: 'AnyName', minLevel: 6 });
  });

  it('should attach a transport to the main logger instance', async () => {
    const { attachTransport } = await import('../logger');
    const myTransport = vi.fn();
    attachTransport(myTransport);
    expect(mockAttachTransport).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should process and forward log objects to the transport', async () => {
    const { attachTransport } = await import('../logger');
    const myTransport = vi.fn();
    attachTransport(myTransport);
    const transportWrapper = mockAttachTransport.mock.calls[0][0];
    const logObject = {
      0: 'log message',
      1: { details: 'some data' },
      _meta: { name: 'TestLogger' },
    };
    transportWrapper(logObject);
    expect(myTransport).toHaveBeenCalledWith(
      ['log message', { details: 'some data' }],
      { name: 'TestLogger' }
    );
  });
});

