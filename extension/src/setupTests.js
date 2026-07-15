import "@testing-library/jest-dom";

global.chrome = {
  storage: {
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
};
