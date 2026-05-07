const deny = name => () => {
  throw new Error(`${name} is disabled in the contest sandbox`);
};

globalThis.fetch = deny('fetch');
globalThis.WebSocket = deny('WebSocket');
globalThis.XMLHttpRequest = deny('XMLHttpRequest');
globalThis.Worker = deny('Worker');
globalThis.SharedWorker = deny('SharedWorker');

globalThis.WebAssembly = new Proxy({}, {
  get() {
    throw new Error('real WebAssembly is disabled in the contest sandbox');
  },
  set() {
    throw new Error('real WebAssembly is disabled in the contest sandbox');
  },
});

