#include "PLL.h"
#include "PLLAlgos.h"

namespace PLL {

static CaseTable table;

// Two bits per U corner then two per U edge, slot order
// Pieces 0 to 3 are the U layer, so each fits in two bits once F2L is solved
uint32_t encode(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 0; i < 4; i++) key = (key << 2) | s.cp[i];
    for (int i = 0; i < 4; i++) key = (key << 2) | s.ep[i];
    return key;
}

bool isSolved(const CubeState& s) {
    return encode(s) == encode(CubeState::solved());
}

void buildTables() {
    table.build(encode, PLL_ALGS, true);
}

int tableSize() {
    return table.size();  // 288 When Every Case Is Present
}

Case find(const CubeState& s)               { return table.find(s); }
std::vector<Move> solve(const CubeState& s) { return find(s).moves; }
std::string caseName(const CubeState& s)    { return find(s).name; }

} // namespace PLL
