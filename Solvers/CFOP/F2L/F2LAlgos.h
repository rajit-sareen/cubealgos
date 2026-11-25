#ifndef F2L_ALGOS_H
#define F2L_ALGOS_H

#include <string>

// Pair Inserted Into the FR Slot, One Alg or More per Case
// Corner and edge start in the U layer or the FR slot, never in another slot
// Each alg ends in the hold it started in. With more than one the solver takes whichever
// turns easiest from the hold it is in
struct F2LAlgo {
    std::string name;
    std::string moves;
};

const F2LAlgo F2L_ALGS[] = {
    {"corner URF D up, edge UR",                     "R U2 R' U' R U R'"},
    {"corner URF D right, edge UR",                  "U' R U' R' U R U R'"},
    {"corner URF D front, edge UR",                  "U R U' R'"},
    {"corner URF D up, edge UB",                     "U R U2 R' U R U' R'"},
    {"corner URF D right, edge UB",                  "R U R'"},
    {"corner URF D front, edge UB",                  "U' R U R' U2 R U' R'"},
    {"corner URF D up, edge UL",                     "U2 R U R' U R U' R'"},
    {"corner URF D right, edge UL",                  "U' R U R' U R U R'"},
    {"corner URF D front, edge UL",                  "U' R U2 R' U2 R U' R'"},
    {"corner URF D up, edge UF",                     "U R U' R' U' R U' R' U R U' R'"},
    {"corner URF D right, edge UF",                  "R' U2 R2 U R2 U R"},
    {"corner URF D front, edge UF",                  "F' U F U2 R U R'"},
    {"corner in slot solved, edge UB",               "U' R' F R F' R U R'"},
    {"corner in slot D front, edge UB",              "R U' R' U R U' R'"},
    {"corner in slot D right, edge UB",              "R U R' U' R U R'"},
    {"corner URF D up, edge UR flipped",             "U' F' U F U F' U F U' F' U F"},
    {"corner URF D right, edge UR flipped",          "R U' R' U2 F' U' F"},
    {"corner URF D front, edge UR flipped",          "F U2 F2 U' F2 U' F'"},
    {"corner URF D up, edge UB flipped",             "U2 F' U' F U' F' U F"},
    {"corner URF D right, edge UB flipped",          "U F' U2 F U2 F' U F"},
    {"corner URF D front, edge UB flipped",          "U F' U' F U' F' U' F"},
    {"corner URF D up, edge UL flipped",             "U' F' U2 F U' F' U F"},
    {"corner URF D right, edge UL flipped",          "U F' U' F U2 F' U F"},
    {"corner URF D front, edge UL flipped",          "F' U' F"},
    {"corner URF D up, edge UF flipped",             "F' U2 F U F' U' F"},
    {"corner URF D right, edge UF flipped",          "U' F' U F"},
    {"corner URF D front, edge UF flipped",          "U F' U F U' F' U' F"},
    {"corner in slot solved, edge UB flipped",       "U F R' F' R F' U' F"},
    {"corner in slot D front, edge UB flipped",      "F' U' F U F' U' F"},
    {"corner in slot D right, edge UB flipped",      "F' U F U' F' U F"},
    {"corner URF D up, edge in slot",                "U R U' R' U R U' R' U R U' R'"},
    {"corner URF D right, edge in slot",             "U R U R' U2 R U R'"},
    {"corner URF D front, edge in slot",             "U' F' U' F U2 F' U' F"},
    {"corner in slot D front, edge in slot",         "R U' R' U' R U R' U2 R U' R'"},
    {"corner in slot D right, edge in slot",         "R U' R' U R U2 R' U R U' R'"},
    {"corner URF D up, edge in slot flipped",        "R U' R' F' U2 F"},
    {"corner URF D right, edge in slot flipped",     "U F' U' F U' R U R'"},
    {"corner URF D front, edge in slot flipped",     "U' R U R' U F' U' F"},
    {"corner in slot solved, edge in slot flipped",  "R2 U2 F R2 F' U2 R' U R'"},
    {"corner in slot D front, edge in slot flipped", "r U' r' U2 r U r' R U R'"},
    {"corner in slot D right, edge in slot flipped", "R U' R' r U' r' U2 r U r'"},

    // Second Algs
    {"corner in slot solved, edge UB",               "U' F' U F U R U' R'"},
    {"corner in slot solved, edge UB flipped",       "U R U' R' U' F' U F"},
    {"corner URF D up, edge in slot",                "R U R' U' R U R' U' R U R'"},
};

#endif // F2L_ALGOS_H
