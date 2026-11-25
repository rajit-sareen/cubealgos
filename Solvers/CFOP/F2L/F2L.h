#ifndef F2L_H
#define F2L_H

#include <cstdint>
#include <string>
#include <vector>
#include "../../../CubeState/CubeState.h"
#include "../../../CubeState/Rotation.h"

// One Pair Inserted
//
// moves finish the pair on their own, in the frame of the state F2L began from. notation
// is what a solver turns, following on from the pair before: a y rotation when the hold
// changes, then the alg as seen from hold. A turn that meets one of the same face at the
// end of the pair before is merged with it, into the later pair, so there it is notation
// read through from the first pair that solves F2L and not one pair's alone
//
// extracted counts the other slots emptied first to free a stuck piece, 0 when the
// pair was a table case as it stood. searched is true only when no alg fit and the
// moves came from the pair search
struct F2LPair {
    int slot;
    std::vector<Move> moves;
    int extracted = 0;
    bool searched = false;
    std::vector<std::string> notation = {};
    Orientation hold = {};
};

// Slot i is corner 4+i with edge 8+i: DFR+FR, DLF+FL, DBL+BL, DRB+BR.
namespace F2L {
    const int SLOTS = 4;

    int corner(int slot);  // Piece Number of the Slot's Corner
    int edge(int slot);    // Piece Number of the Slot's Edge

    // Cross and All Four Pairs Home
    bool isSolved(const CubeState& s);

    // Case Table, Every FR Pair Case to the Algs That Insert It
    void buildTables();
    int tableSize();

    // Moves that empty the FR slot and touch nothing else below the U layer, one
    // R U R' or F' U' F trigger per U angle. Seen from a slot's own side they empty
    // that slot instead
    const std::vector<std::vector<Move>>& extracts();

    // How to insert the slot's pair, no moves if it is already home
    // An alg for the case when the table has one. A piece stuck in another slot is
    // lifted out with one of that slot's extracts first, then the alg. Either way the
    // cross and every pair outside the emptied slots are kept. Only if no alg fits, a
    // search that keeps the cross and the placed pairs
    F2LPair planPair(const CubeState& s, int slot, int placed);
    std::vector<Move> solvePair(const CubeState& s, int slot, int placed);

    // The four pairs in the order, with the algs and from the holds that are easiest to
    // turn taken together. before is what was turned just before, so the first pair can
    // steer clear of undoing it
    std::vector<F2LPair> solve(const CubeState& s, const std::vector<Move>& before = {});

} // namespace F2L

#endif // F2L_H
