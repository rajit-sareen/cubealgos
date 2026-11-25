#ifndef PLL_ALGOS_H
#define PLL_ALGOS_H

#include "../CaseTable.h"

// One Alg per Case
const CaseAlgo PLL_ALGS[] = {
    {"Aa", "x R' U R' D2 R U' R' D2 R2 x'"},
    {"Ab", "x R2 D2 R U R' D2 R U' R x'"},
    {"E",  "x' R U' R' D R U R' D' R U R' D R U' R' D' x"},
    {"F",  "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"},
    {"Ga", "R2 U R' U R' U' R U' R2 U' D R' U R D'"},
    {"Gb", "R' U' R U D' R2 U R' U R U' R U' R2 D"},
    {"Gc", "R2 U' R U' R U R' U R2 U D' R U' R' D"},
    {"Gd", "R U R' U' D R2 U' R U' R' U R' U R2 D'"},
    {"H",  "M2 U M2 U2 M2 U M2"},
    {"Ja", "L' U' L F L' U' L U L F' L2 U L"},
    {"Jb", "R U R' F' R U R' U' R' F R2 U' R'"},
    {"Na", "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"},
    {"Nb", "R' U R U' R' F' U' F R U R' F R' F' R U' R"},
    {"Ra", "R U' R' U' R U R D R' U' R D' R' U2 R'"},
    {"Rb", "R' U2 R U2 R' F R U R' U' R' F' R2"},
    {"T",  "R U R' U' R' F R2 U' R' U' R U R' F'"},
    {"Ua", "M2 U M U2 M' U M2"},
    {"Ub", "M2 U' M U2 M' U' M2"},
    {"V",  "R' U R' U' B' R' B2 U' B' U B' R B R"},
    {"Y",  "F R U' R' U' R U R' F' R U R' U' R' F R F'"},
    {"Z",  "M' U M2 U M2 U M' U2 M2"},
};

#endif // PLL_ALGOS_H
