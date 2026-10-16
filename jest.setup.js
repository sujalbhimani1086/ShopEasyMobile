/* eslint-env jest */
const mockStorageMap = new Map();

const mockAsyncStorage = {
  setItem: jest.fn(async (key, value) => {
    mockStorageMap.set(key, String(value));
  }),
  getItem: jest.fn(async (key) => {
    return mockStorageMap.has(key) ? mockStorageMap.get(key) : null;
  }),
  removeItem: jest.fn(async (key) => {
    mockStorageMap.delete(key);
  }),
  clear: jest.fn(async () => {
    mockStorageMap.clear();
  }),
  getAllKeys: jest.fn(async () => {
    return Array.from(mockStorageMap.keys());
  }),
  __getRawStorage: () => mockStorageMap,
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('react-native-razorpay', () => {
  return {
    open: jest.fn(() =>
      Promise.resolve({
        razorpay_payment_id: 'pay_test_mock123',
        razorpay_order_id: 'order_test_mock123',
        razorpay_signature: 'sig_test_mock123',
      })
    ),
    onExternalWalletSelection: jest.fn(),
  };
});

jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn(async (options) => ({
    filePath: `/mock/Downloads/${options.fileName || 'invoice'}.pdf`,
    numberOfPages: 1,
  })),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      DownloadDir: '/mock/Downloads',
      DocumentDir: '/mock/Documents',
    },
    cp: jest.fn(async () => true),
    exists: jest.fn(async () => true),
    scanFile: jest.fn(async () => true),
  },
  MediaCollection: {
    copyToMediaStore: jest.fn(async (file, collection, src) => `content://media/external/downloads/${file.name}`),
  },
  android: {
    actionViewIntent: jest.fn(async () => true),
  },
}));

const actualReactQuery = jest.requireActual('@tanstack/react-query');
const mockTestQueryClient = new actualReactQuery.QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity,
    },
  },
});

if (actualReactQuery.QueryClientContext) {
  actualReactQuery.QueryClientContext._currentValue = mockTestQueryClient;
  actualReactQuery.QueryClientContext._currentValue2 = mockTestQueryClient;
}

if (typeof afterEach === 'function') {
  afterEach(() => {
    mockTestQueryClient.clear();
  });
}
