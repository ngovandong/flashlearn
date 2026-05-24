import "@testing-library/jest-dom";

global.chrome = {
  storage: {
    sync: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};
