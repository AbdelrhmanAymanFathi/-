// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_FILENAME = ':memory:';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Generate test data
  createTestDelivery: (overrides = {}) => ({
    date: '2024-01-01',
    contractor_id: 1,
    supplier_id: 1,
    vehicle_no: 'TEST-123',
    company_voucher_no: 'VOUCHER-001',
    volume: 10.0,
    unit: 'm³',
    unit_price: 5.50,
    gross_value: 55.00,
    discount: 2.00,
    net_value: 53.00,
    item_description: 'Test delivery',
    ...overrides
  }),

  // Generate test user
  createTestUser: (overrides = {}) => ({
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: 'accountant',
    ...overrides
  }),

  // Mock JWT token
  mockJWTToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJhY2NvdW50YW50IiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',

  // Mock request object
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    get: jest.fn(),
    ...overrides
  }),

  // Mock response object
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  },

  // Mock next function
  mockNext: jest.fn(),

  // Clean up function
  cleanup: () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  }
};

// Before each test
beforeEach(() => {
  global.testUtils.cleanup();
});

// After each test
afterEach(() => {
  global.testUtils.cleanup();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

