# cubealgos web

The site at [godking123.github.io/cubealgos](https://godking123.github.io/cubealgos/).
This is a React front end for the engine. The C++ solvers are compiled to WebAssembly
and run in a worker in the visitor's browser, so the site is plain static files.

<img src="../docs/assets/simulator.png" alt="cubealgos simulator" width="100%">

## Pages

- **Timer**: hold Space (or touch the clock) until it turns green, let go to start,
  any key to stop. WCA scrambles with a preview net, optional inspection, and optional
  stage splits. Solves are saved in sessions in the browser's IndexedDB.
- **Stats**: times and averages per session or across all of them, the time
  distribution, stage splits and the optimal cross on every colour.
- **Simulator**: scramble a 3D cube and step through the engine's CFOP or Kociemba
  solution.
- **Profile** (the icon at the top right): your method and cross colour, plus a quick
  guide.

## Working on the Site

Needs [emsdk](https://emscripten.org/docs/getting_started/downloads.html) and Node 20+.
Run the commands from the repo root:

```sh
make wasm                 # compiles the engine to Web/src/engine/
cd Web && npm install
npm run dev               # dev server at http://localhost:5173
npm run build             # static site in Web/dist/
```

## Deploying

`.github/workflows/pages.yml` runs the tests, builds the engine and the site, and
publishes it to GitHub Pages on every push to `main`.
