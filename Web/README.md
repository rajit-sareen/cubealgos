# cubealgos web

The site at [rajit-sareen.github.io/cubealgos](https://rajit-sareen.github.io/cubealgos/):
a React front end with the C++ engine compiled to WebAssembly, running in a worker.

Needs [emsdk](https://emscripten.org/docs/getting_started/downloads.html) and Node 20+.
From the repo root:

```sh
make wasm                 # compiles the engine to Web/src/engine/
cd Web && npm install
npm run dev               # dev server at http://localhost:5173
```
