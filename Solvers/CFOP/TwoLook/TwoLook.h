#ifndef TWO_LOOK_H
#define TWO_LOOK_H

#include "../CaseTable.h"
#include "../../../CubeState/CubeState.h"

// The first look of 2-look OLL and of 2-look PLL, F2L already solved
//
// The second looks need no tables of their own. With the edges oriented the only cases
// OLL::find can meet are OLL 21 to 27, and with the corners permuted the only ones
// PLL::find can meet are Ua, Ub, H and Z, so the four looks are 16 algs in all
namespace TwoLook {
    bool edgesOriented(const CubeState& s);
    bool cornersPermuted(const CubeState& s);  // Home up to a U Turn

    // Case Tables
    void buildTables();
    int edgeTableSize();
    int cornerTableSize();

    // Orient the U edges, twisting the corners however they like
    Case orientEdges(const CubeState& s);

    // Permute the U corners, the U layer oriented before and after
    Case permuteCorners(const CubeState& s);
} // namespace TwoLook

#endif // TWO_LOOK_H
