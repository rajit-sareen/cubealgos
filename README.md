<img src="docs/assets/logo.svg" alt="cubealgos" width="140">

# cubealgos

`cubealgos` is a Rubik's Cube engine and solver collection written in C++. It
generates WCA random-state scrambles and solves them with a choice of methods.

[![C++](https://img.shields.io/badge/C%2B%2B-17-blue?style=flat)](#build)
[![license](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat)](#build)

**Just want to time solves?** Use the site at
**[godking123.github.io/cubealgos](https://godking123.github.io/cubealgos/)**: a cube
timer, stats and a 3D simulator, running this same engine in your browser. Nothing to
install.

## Build

Needs a C++17 compiler and `make`.

```sh
make              # builds ./cubealgo and ./tests
make test         # runs the test suite
```

## Run

```sh
./cubealgo
```

Pick a method, then press ENTER for a WCA random-state scramble and its solution.
`m` changes method, `q` quits.

## Methods

| Method   | Approach                           | Status          |
|----------|------------------------------------|-----------------|
| Kociemba | Two-phase IDA* search, 18–22 moves | Done            |
| CFOP     | Cross, F2L, OLL, PLL               | Done            |
| Roux     | Blocks, CMLL, LSE                  | Not written yet |

## Layout

```
CubeState/     Cube representation, move tables, notation, scrambles
Solvers/       One directory per method, all behind Method.h
Scramblers/    WCA random-state scrambles (needs a solver, so it sits above both)
Main.cc        The command-line front end
Tests.cc       The numbered test suite
```

Adding a method is a new directory under `Solvers/` and one line in
`Solvers/Method.cc`.

## The Website

The site's source lives in `Web/` and deploys itself from `main`. You don't need it to
build or run the engine. If you're working on the site itself, see
[Web/README.md](Web/README.md).

## License

MIT
