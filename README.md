<img src="docs/assets/logo.svg" alt="cubealgos" width="140">

# cubealgos

A Rubik's Cube engine and solver collection in C++. Generates WCA random-state
scrambles and solves them with a choice of methods.

**Try it in the browser:** [rajit-sareen.github.io/cubealgos](https://rajit-sareen.github.io/cubealgos/),
a timer, stats and 3D simulator running this engine as WebAssembly.

## Build and Run

Needs a C++17 compiler and `make`.

```sh
make              # builds ./cubealgo and ./tests
make test         # runs the test suite
./cubealgo        # ENTER for a scramble and solution, m changes method, q quits
```

## Methods

| Method      | Approach                              | Status          |
|-------------|---------------------------------------|-----------------|
| Kociemba    | Two-phase IDA* search, 18–22 moves    | Done            |
| CFOP        | Cross, F2L, OLL, PLL                  | Done            |
| CFOP 2-look | CFOP with 2-look OLL and PLL, 16 algs | Done            |
| Roux        | Blocks, CMLL, LSE                     | Not written yet |

## Layout

```
CubeState/     Cube representation, move tables, notation, scrambles
Solvers/       One directory per method, all behind Method.h
Scramblers/    WCA random-state scrambles
Web/           The browser site (see Web/README.md)
Main.cc        The command-line front end
Tests.cc       The numbered test suite
```

## License

MIT
