#ifndef TWO_LOOK_ALGOS_H
#define TWO_LOOK_ALGOS_H

#include "../CaseTable.h"

// Edge Orientation
const CaseAlgo EO_ALGS[] = {
    {"Line",    "F R U R' U' F'"},
    {"L shape", "F U R U' R' F'"},
    {"Dot",     "F R U R' U' F' f R U R' U' f'"},
};

// Corner Permutation, Adjacent Swap Then Diagonal Swap
const CaseAlgo CP_ALGS[] = {
    {"T", "R U R' U' R' F R2 U' R' U' R U R' F'"},
    {"Y", "F R U' R' U' R U R' F' R U R' U' R' F R F'"},
};

#endif // TWO_LOOK_ALGOS_H
