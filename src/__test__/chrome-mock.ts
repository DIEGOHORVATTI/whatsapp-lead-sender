import { vi } from "vitest";

const storageMock = {
  local: {
    get: vi.fn((_cb: unknown) => {}),
    set: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const runtimeMock = {
  getManifest: vi.fn(() => ({ version: "0.0.0-test" })),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  sendMessage: vi.fn(),
};

const tabsMock = {
  query: vi.fn(),
  sendMessage: vi.fn(),
  create: vi.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = {
  storage: storageMock,
  runtime: runtimeMock,
  tabs: tabsMock,
};

export { storageMock, runtimeMock, tabsMock };
