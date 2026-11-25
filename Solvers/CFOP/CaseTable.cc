#include "CaseTable.h"
#include <sstream>
#include "../../CubeState/Rotation.h"
#include "../../CubeState/Scramble.h"

// The case an alg solves is the alg undone on a solved cube
// Of two algs for one case the shorter as written is kept
void CaseTable::insert(const std::string& written, const std::string& name) {
    Case c = {name, {}, canonicalize(parseWritten(written))};
    std::istringstream in(written);
    std::string tok;
    while (in >> tok) c.notation.push_back(tok);

    CubeState s = CubeState::solved();
    for (int i = c.moves.size() - 1; i >= 0; i--) s = s.apply(inverseMove(c.moves[i]));
    uint32_t key = encode(s);
    auto it = table.find(key);
    if (it == table.end() || c.notation.size() < it->second.notation.size()) table[key] = c;
}

// Each alg is written for one angle, so the U turn that lines the case up, and the one
// that lines the layer up after, are baked into the table rather than searched for at
// solve time
void CaseTable::build(Encode enc, const CaseAlgo* algs, std::size_t count, bool finish) {
    static const std::vector<std::string> AUF = {"", "U", "U2", "U'"}, NONE = {""};
    const std::vector<std::string>& after = finish ? AUF : NONE;
    encode = enc;
    table.clear();
    for (const std::string& post : after) insert(post, "");
    for (std::size_t i = 0; i < count; i++)
        for (const std::string& pre : AUF)
            for (const std::string& post : after)
                insert(pre + " " + algs[i].moves + " " + post, algs[i].name);
}

Case CaseTable::find(const CubeState& s) const {
    if (!encode) return {};
    auto it = table.find(encode(s));
    return it == table.end() ? Case{} : it->second;
}
