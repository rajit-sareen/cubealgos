#include "Method.h"
#include "KociembaNaive/Kociemba.h"
#include "CFOP/CFOP.h"
#include "Roux/Roux.h"

const Method METHODS[4] = {
    {"Kociemba", "two-phase IDA* search, 18-22 moves", true,
     Kociemba::buildTables, Kociemba::solve, nullptr},
    {"CFOP",     "cross, F2L, OLL, PLL",               true,
     CFOP::buildTables,     CFOP::solve,     CFOP::stages},
    {"CFOP 2-look", "CFOP with 2-look OLL and PLL, 16 algs", true,
     CFOP::buildTables,     CFOP::solveTwoLook, CFOP::stagesTwoLook},
    {"Roux",     "blocks, CMLL, LSE",                  false,
     Roux::buildTables,     Roux::solve,     nullptr},
};

const int METHOD_COUNT = 4;
