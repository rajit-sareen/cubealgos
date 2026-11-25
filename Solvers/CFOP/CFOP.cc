#include "CFOP.h"
#include "../../CubeState/Rotation.h"
#include "../../CubeState/Scramble.h"
#include "Cross/Cross.h"
#include "F2L/F2L.h"
#include "OLL/OLL.h"
#include "PLL/PLL.h"
#include "TwoLook/TwoLook.h"

namespace CFOP {

// Cross searches, F2L and the last layer look their cases up
void buildTables() {
    F2L::buildTables();
    OLL::buildTables();
    PLL::buildTables();
    TwoLook::buildTables();
}

// Every stage works in the cross frame, the cheapest colour on the bottom
// Moves are translated back so Main executes them in the scrambling frame like every
// other method, and the notation opens with the rotation instead
static std::vector<Stage> run(const CubeState& s, bool twoLook) {
    CrossResult cross = Cross::bestCross(s);
    CubeState state = s.rotate(cross.hold);
    std::vector<Stage> result;

    // Execute One Step, as Part of the Last Stage Opened
    auto append = [&](const std::vector<Move>& moves, const std::string& notation) {
        Stage& stage = result.back();
        for (Move m : moves) {
            state = state.apply(m);
            stage.moves.push_back(translateMove(m, cross.hold));
        }
        if (!stage.notation.empty() && !notation.empty()) stage.notation += " ";
        stage.notation += notation;
    };
    auto look = [&](const char* name, Case (*find)(const CubeState&)) {
        result.push_back({name, {}, ""});
        Case c = find(state);
        std::string notation;
        for (const std::string& t : c.notation) notation += (notation.empty() ? "" : " ") + t;
        append(c.moves, notation);
    };

    result.push_back({"Cross", {}, rotationsTo(cross.hold)});
    append(cross.moves, sequenceName(cross.moves));
    result.push_back({"F2L", {}, ""});
    for (const F2LPair& p : F2L::solve(state)) append(p.moves, sequenceName(p.moves));
    if (twoLook) look("EOLL", TwoLook::orientEdges);
    look(twoLook ? "OCLL" : "OLL", OLL::find);
    if (twoLook) look("CPLL", TwoLook::permuteCorners);
    look(twoLook ? "EPLL" : "PLL", PLL::find);
    return result;
}

static std::vector<Move> flatten(const std::vector<Stage>& stages) {
    std::vector<Move> moves;
    for (const Stage& stage : stages)
        moves.insert(moves.end(), stage.moves.begin(), stage.moves.end());
    return moves;
}

std::vector<Stage> stages(const CubeState& s)        { return run(s, false); }
std::vector<Stage> stagesTwoLook(const CubeState& s) { return run(s, true); }
std::vector<Move> solve(const CubeState& s)          { return flatten(run(s, false)); }
std::vector<Move> solveTwoLook(const CubeState& s)   { return flatten(run(s, true)); }

} // namespace CFOP
