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

static std::string joinTurns(const std::vector<std::string>& turns) {
    std::string s;
    for (const std::string& t : turns) s += (s.empty() ? "" : " ") + t;
    return s;
}

// Every stage works in the cross frame, the cheapest colour on the bottom
// Moves are translated back so Main executes them in the scrambling frame like every
// other method, and the notation opens with the rotation instead
static std::vector<Stage> run(const CubeState& s, bool twoLook) {
    CrossResult cross = Cross::bestCross(s);
    CubeState state = s.rotate(cross.hold);
    Orientation hold = cross.hold;
    std::vector<Stage> result;

    // Execute One Step, as Part of the Last Stage Opened
    auto append = [&](const std::vector<Move>& moves, const std::string& notation) {
        Stage& stage = result.back();
        for (Move m : moves) {
            state = state.apply(m);
            stage.moves.push_back(translateMove(m, hold));
        }
        if (!stage.notation.empty() && !notation.empty()) stage.notation += " ";
        stage.notation += notation;
    };
    auto look = [&](const char* name, Case (*find)(const CubeState&)) {
        result.push_back({name, {}, ""});
        Case c = find(state);
        append(c.moves, joinTurns(c.notation));
    };

    result.push_back({"Cross", {}, rotationsTo(cross.hold)});
    append(cross.moves, sequenceName(cross.moves));
    result.push_back({"F2L", {}, ""});
    Orientation turned;
    for (const F2LPair& p : F2L::solve(state, cross.moves)) {
        append(p.moves, joinTurns(p.notation));
        turned = p.hold;
    }
    result.back().moves = canonicalize(result.back().moves);

    // The Last Layer Goes On From the Hold F2L Ended In
    state = state.rotate(turned);
    hold = hold.then(turned);
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
