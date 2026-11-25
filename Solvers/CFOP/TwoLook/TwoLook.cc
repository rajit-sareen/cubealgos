#include "TwoLook.h"
#include "TwoLookAlgos.h"

namespace TwoLook {

static CaseTable edgeTable, cornerTable;

// One Flip Bit per U Edge
static uint32_t encodeEdges(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 0; i < 4; i++) key = (key << 1) | s.eo[i];
    return key;
}

// Corners relative to the first, since a U turn moves all four round together and the
// last U turn is left to the edge permutation
static uint32_t encodeCorners(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 1; i < 4; i++) key = (key << 2) | ((s.cp[i] - s.cp[0]) & 3);
    return key;
}

bool edgesOriented(const CubeState& s) {
    return encodeEdges(s) == 0;
}

bool cornersPermuted(const CubeState& s) {
    return encodeCorners(s) == encodeCorners(CubeState::solved());
}

void buildTables() {
    edgeTable.build(encodeEdges, EO_ALGS);
    cornerTable.build(encodeCorners, CP_ALGS);
}

int edgeTableSize()   { return edgeTable.size(); }    // 8 When Every Case Is Present
int cornerTableSize() { return cornerTable.size(); }  // 6 When Every Case Is Present

Case orientEdges(const CubeState& s)    { return edgeTable.find(s); }
Case permuteCorners(const CubeState& s) { return cornerTable.find(s); }

} // namespace TwoLook
