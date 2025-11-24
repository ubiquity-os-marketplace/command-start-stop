const mockKv = {
  _data: new Map<string, unknown>(),

  async get(key: string[]) {
    const keyStr = JSON.stringify(key);
    return { value: this._data.get(keyStr) || null };
  },

  async set(key: string[], value: unknown) {
    const keyStr = JSON.stringify(key);
    this._data.set(keyStr, value);
  },

  async delete(key: string[]) {
    const keyStr = JSON.stringify(key);
    this._data.delete(keyStr);
  },

  async *list(options: { prefix: string[] }) {
    const prefixStr = JSON.stringify(options.prefix);
    for (const [keyStr, value] of this._data.entries()) {
      const key = JSON.parse(keyStr);
      if (JSON.stringify(key.slice(0, options.prefix.length)) === prefixStr) {
        yield { key, value };
      }
    }
  },

  close() {
    this._data.clear();
  },
};

function mockOpenKv() {
  return Promise.resolve(mockKv);
}

// @ts-expect-error - Deno isn't defined without having the DenoLand extension installed or within the runtime
if (globalThis.Deno) {
  // @ts-expect-error - Deno isn't defined without having the DenoLand extension installed or within the runtime
  Object.defineProperty(globalThis.Deno, "openKv", {
    value: mockOpenKv,
    writable: true,
    configurable: true,
  });
} else {
  // @ts-expect-error - Deno isn't defined without having the DenoLand extension installed or within the runtime
  globalThis.Deno = {
    openKv: mockOpenKv,
    // @ts-expect-error - Deno isn't defined without having the DenoLand extension installed or within the runtime
  } as unknown as typeof Deno;
}
