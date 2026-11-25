#include "OLL.h"
#include "OLLAlgos.h"

namespace OLL {

static CaseTable table;

// Two bits per U corner then one per U edge, slot order
// U turns do not twist or flip, so the key changes only through the slots pieces sit in
uint32_t encode(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 0; i < 4; i++) key = (key << 2) | s.co[i];
    for (int i = 0; i < 4; i++) key = (key << 1) | s.eo[i];
    return key;
}

bool isSolved(const CubeState& s) {
    return encode(s) == 0;
}

void buildTables() {
    table.build(encode, OLL_ALGS);
}

int tableSize() {
    return table.size();  // 216 When Every Case Is Present
}

Case find(const CubeState& s)               { return table.find(s); }
std::vector<Move> solve(const CubeState& s) { return find(s).moves; }
std::string caseName(const CubeState& s)    { return find(s).name; }

} // namespace OLL
