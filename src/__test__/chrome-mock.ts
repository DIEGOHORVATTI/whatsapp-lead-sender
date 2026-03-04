import { vi } from 'vitest'

const storageMock = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
}

const runtimeMock = {
  getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  sendMessage: vi.fn(),
}

const tabsMock = {
  query: vi.fn(),
  sendMessage: vi.fn(),
  create: vi.fn(),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-member-access
;(globalThis as any).chrome = {
  storage: storageMock,
  runtime: runtimeMock,
  tabs: tabsMock,
}

export { storageMock, runtimeMock, tabsMock }
