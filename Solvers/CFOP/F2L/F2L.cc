#include "F2L.h"
#include <algorithm>
#include <map>
#include <sstream>
#include <unordered_map>
#include "F2LAlgos.h"
#include "../Cross/Cross.h"
#include "../PieceSearch.h"
#include "../../../CubeState/Rotation.h"
#include "../../../CubeState/Scramble.h"

namespace F2L {

int corner(int slot) { return 4 + slot; }
int edge(int slot)   { return 8 + slot; }

// Tracked Pieces for a Set of Slots, Cross Included
static uint16_t edgeMask(int slots) {
    uint16_t mask = Cross::EDGES;
    for (int i = 0; i < SLOTS; i++)
        if (slots & (1 << i)) mask |= 1 << edge(i);
    return mask;
}

static uint8_t cornerMask(int slots) {
    uint8_t mask = 0;
    for (int i = 0; i < SLOTS; i++)
        if (slots & (1 << i)) mask |= 1 << corner(i);
    return mask;
}

const int ALL_SLOTS = (1 << SLOTS) - 1;

bool isSolved(const CubeState& s) {
    return PieceSearch::isSolved(s, edgeMask(ALL_SLOTS), cornerMask(ALL_SLOTS));
}

using Written = std::vector<std::string>;

// One Way to Insert a Pair, Written From the Cross Frame
struct Plan {
    int slot;
    Written turns;
    int extracted;
    CubeState after;
};

static std::unordered_map<uint64_t, std::vector<Written>> table;  // Key : Algs to Insert
static Orientation frames[SLOTS];                                 // Slot Seen as FR
static Orientation HOLDS[4];                                      // y Turned Holds

static std::string join(const Written& turns) {
    std::string s;
    for (const std::string& t : turns) s += (s.empty() ? "" : " ") + t;
    return s;
}

static Written seenFrom(const Written& turns, const Orientation& o) {
    Written result;
    for (const std::string& t : turns) result.push_back(translateTurn(t, o));
    return result;
}

// Slot and twist of the FR pair only, the rest of the cube is left to the alg
static uint64_t encode(const CubeState& s) {
    return PieceSearch::encode(s, 1 << edge(0), 1 << corner(0));
}

// The case an alg solves is the alg undone on a solved cube
// An alg that disturbs the cross or another pair would break placed slots, so it is
// left out rather than trusted
static void insert(const Written& turns) {
    std::vector<Move> seq = parseWritten(join(turns));
    CubeState s = CubeState::solved();
    for (int i = seq.size() - 1; i >= 0; i--) s = s.apply(inverseMove(seq[i]));
    int others = ALL_SLOTS & ~1;
    if (!PieceSearch::isSolved(s, edgeMask(others), cornerMask(others))) return;
    std::vector<Written>& algs = table[encode(s)];
    if (std::find(algs.begin(), algs.end(), turns) == algs.end()) algs.push_back(turns);
}

// Every alg is written for the FR slot, so the other slots are solved from a y turned
// frame whose front face is the slot's own: F, L, B, R for slots 0 to 3
//
// A case can be reached by several algs. One far longer than the shortest, or with a U
// turn first that the shortest does without, is never worth turning and is dropped
void buildTables() {
    table.clear();
    insert({});
    for (const F2LAlgo& a : F2L_ALGS) {
        for (const char* pre : {"", "U", "U2", "U'"}) {
            Written turns;
            std::istringstream in(pre + (" " + a.moves));
            std::string tok;
            while (in >> tok) appendTurn(turns, tok);
            insert(turns);
        }
    }
    for (auto& entry : table) {
        std::vector<Written>& algs = entry.second;
        size_t shortest = algs[0].size();
        for (const Written& w : algs) shortest = std::min(shortest, w.size());
        auto longer = [&](const Written& w) { return w.size() > shortest + 2 || (w[0][0] == 'U' && w.size() > shortest); };
        if (shortest > 0) algs.erase(std::remove_if(algs.begin(), algs.end(), longer), algs.end());
        else algs = {{}};
    }

    static const Move FRONT[SLOTS] = {Move::F, Move::L, Move::B, Move::R};
    Orientation o;
    for (int turn = 0; turn < 4; turn++, o = o.then(CubeRot::y)) {
        HOLDS[turn] = o;
        for (int slot = 0; slot < SLOTS; slot++)
            if (translateMove(Move::F, o) == FRONT[slot]) frames[slot] = o;
    }
}

int tableSize() {
    return table.size();  // 150 When Every Case Is Present, Solved Included
}

const std::vector<std::vector<Move>>& extracts() {
    static const std::vector<std::vector<Move>> EXTRACTS = {
        {Move::R, Move::U, Move::Rp},  {Move::R, Move::Up, Move::Rp},  {Move::R, Move::U2, Move::Rp},
        {Move::Fp, Move::U, Move::F},  {Move::Fp, Move::Up, Move::F},  {Move::Fp, Move::U2, Move::F},
    };
    return EXTRACTS;
}

// Other slots holding one of the pair's pieces, as a slot mask
static int stuckIn(const CubeState& s, int slot) {
    int mask = 0;
    for (int k = 0; k < SLOTS; k++) {
        if (k == slot) continue;
        if (s.cp[corner(k)] == corner(slot) || s.ep[edge(k)] == edge(slot)) mask |= 1 << k;
    }
    return mask;
}

// Effort of One Turn by Layer, a Plain R or U Being 1
//
// The numbers only have to rank: R, U and L flow, F and D break the grip, and B is worse
// than rotating to make it something else
static double effort(char layer) {
    switch (layer) {
        case 'R': case 'U': return 1.0;
        case 'L': case 'r': return 1.1;
        case 'l':           return 1.3;
        case 'F':           return 1.5;
        case 'f':           return 1.8;
        case 'D':           return 1.8;
        case 'B':           return 4.5;
        default:            return 5.0;
    }
}

const double HALF_TURN = 0.2;      // Over a Quarter
const double ROTATION  = 1.5;      // y or y'
const double ROTATION2 = 2.0;      // y2
const double SAME_FACE = 1.0;      // A Join That Would Merge Two Steps

static double effort(const Written& turns, const Orientation& hold) {
    Orientation seen = hold.inverse();
    double total = 0;
    for (const std::string& t : turns)
        total += effort(translateTurn(t, seen)[0]) + (t.back() == '2' ? HALF_TURN : 0);
    return total;
}

static double easiest(const Written& turns) {
    double best = effort(turns, HOLDS[0]);
    for (int h = 1; h < 4; h++) best = std::min(best, effort(turns, HOLDS[h]));
    return best;
}

const int MAX_EXTRACTS = 2;  // Two Stuck Pieces Need at Most Two
const size_t MAX_PLANS = 3;  // Ways Kept per Pair

// Every extracts-then-alg for the pair within depth
//
// Each stuck slot is emptied by one of its extracts, which brings the piece to the U
// layer, so after at most one extract per stuck piece the pair is a table case.
// Adjacent turns of the joined sequence are merged, as a solver would
static void collect(const CubeState& s, int slot, int depth, const Written& lifted,
                    int extracted, std::vector<Plan>& plans) {
    auto it = table.find(encode(s.rotate(frames[slot])));
    if (it != table.end()) {
        for (const Written& alg : it->second) {
            Plan p = {slot, lifted, extracted, s};
            Written turns = seenFrom(alg, frames[slot]);
            for (const std::string& t : turns) appendTurn(p.turns, t);
            for (Move m : parseWritten(join(turns))) p.after = p.after.apply(m);
            plans.push_back(p);
        }
        return;
    }
    if (depth == 0) return;

    int stuck = stuckIn(s, slot);
    for (int k = 0; k < SLOTS; k++) {
        if (!(stuck & (1 << k))) continue;
        for (const std::vector<Move>& e : extracts()) {
            Written lift = lifted;
            CubeState next = s;
            for (Move m : e) {
                Move t = translateMove(m, frames[k]);
                appendTurn(lift, moveName(t));
                next = next.apply(t);
            }
            collect(next, slot, depth - 1, lift, extracted + 1, plans);
        }
    }
}

// The few easiest, none when no alg fits
static std::vector<Plan> plansFor(const CubeState& s, int slot) {
    std::vector<Plan> plans;
    collect(s, slot, MAX_EXTRACTS, {}, 0, plans);
    std::vector<std::pair<double, size_t>> order;
    for (size_t i = 0; i < plans.size(); i++) order.push_back({easiest(plans[i].turns), i});
    std::sort(order.begin(), order.end());
    std::vector<Plan> best;
    for (size_t i = 0; i < order.size() && i < MAX_PLANS; i++) best.push_back(plans[order[i].second]);
    return best;
}

static F2LPair searchPair(const CubeState& s, int slot, int placed) {
    int tracked = placed | (1 << slot);
    return {slot, PieceSearch::solve(s, edgeMask(tracked), cornerMask(tracked)), 0, true};
}

F2LPair planPair(const CubeState& s, int slot, int placed) {
    std::vector<Plan> plans = plansFor(s, slot);
    if (plans.empty()) return searchPair(s, slot, placed);
    return {slot, canonicalize(parseWritten(join(plans[0].turns))), plans[0].extracted, false};
}

std::vector<Move> solvePair(const CubeState& s, int slot, int placed) {
    return planPair(s, slot, placed).moves;
}

namespace {

struct Step {
    Plan plan;
    int hold;
};

// Branch and bound over the order of the pairs, the way each is inserted and the hold it
// is turned from, for the least effort in all
//
// Greedy rounds miss that inserting one pair frees another, and that a rotation worth
// making for one pair is paid for once by the pairs that share its hold
struct Planner {
    std::vector<Step> path, best;
    double bestCost = 1e9;
    // State and Slot : Plans
    std::map<std::pair<std::string, int>, std::vector<Plan>> seen;

    const std::vector<Plan>& plans(const CubeState& s, int slot) {
        std::string key(reinterpret_cast<const char*>(&s), sizeof s);
        auto it = seen.find({key, slot});
        if (it == seen.end()) it = seen.emplace(std::make_pair(key, slot), plansFor(s, slot)).first;
        return it->second;
    }

    // last is the face turned last, in the cross frame, 0 for none
    void extend(const CubeState& s, int placed, int hold, char last, double cost) {
        if (cost >= bestCost) return;
        if (placed == ALL_SLOTS) {
            bestCost = cost;
            best = path;
            return;
        }

        struct Option { double cost; const Plan* plan; int hold; };
        std::vector<Option> options;
        for (int slot = 0; slot < SLOTS; slot++) {
            if (placed & (1 << slot)) continue;
            for (const Plan& p : plans(s, slot)) {
                if (p.turns.empty()) {
                    options.push_back({0, &p, hold});
                    continue;
                }
                double join = p.turns[0][0] == last ? SAME_FACE : 0;
                Option held[4];
                for (int h = 0; h < 4; h++) {
                    int turn = (h - hold + 4) % 4;
                    double rotate = turn == 0 ? 0 : turn == 2 ? ROTATION2 : ROTATION;
                    held[h] = {join + rotate + effort(p.turns, HOLDS[h]), &p, h};
                }
                std::sort(held, held + 4, [](const Option& a, const Option& b) { return a.cost < b.cost; });
                options.insert(options.end(), held, held + 2);
            }
        }
        // A pair already home costs nothing and can only get in the way
        std::stable_sort(options.begin(), options.end(),
                         [](const Option& a, const Option& b) { return a.cost < b.cost; });
        if (!options.empty() && options[0].cost == 0) options.erase(options.begin() + 1, options.end());
        for (const Option& o : options) {
            path.push_back({*o.plan, o.hold});
            char end = o.plan->turns.empty() ? last : o.plan->turns.back()[0];
            extend(o.plan->after, placed | (1 << o.plan->slot), o.hold, end, cost + o.cost);
            path.pop_back();
        }
    }
};

} // namespace

// A turn is dropped from the end of the pair before and its remainder opens the next, as
// the pair before is the one a solver has stopped thinking about
static void writeOut(std::vector<F2LPair>& pairs, const std::vector<Written>& turns) {
    Orientation hold;
    Written* before = nullptr;
    Orientation beforeHold;
    for (size_t i = 0; i < pairs.size(); i++) {
        F2LPair& p = pairs[i];
        if (turns[i].empty()) {
            p.hold = hold;
            continue;
        }
        Written alg = turns[i];
        // Wide turns end in another frame, so only plain faces are compared
        if (before && !before->empty() && before->back()[0] < 'a' && alg[0][0] < 'a') {
            std::string end = translateTurn(before->back(), beforeHold);
            if (end[0] == alg[0][0]) {
                Written merged = {end};
                appendTurn(merged, alg[0]);
                before->pop_back();
                alg.erase(alg.begin());
                alg.insert(alg.begin(), merged.begin(), merged.end());
            }
        }
        std::string rotation = rotationsTo(hold.inverse().then(p.hold));
        if (!rotation.empty()) p.notation.push_back(rotation);
        for (const std::string& t : seenFrom(alg, p.hold.inverse())) p.notation.push_back(t);
        hold = p.hold;
        before = &p.notation;
        beforeHold = p.hold;
    }
}

std::vector<F2LPair> solve(const CubeState& s, const std::vector<Move>& before) {
    Planner planner;
    planner.extend(s, 0, 0, before.empty() ? 0 : moveName(before.back())[0], 0);

    std::vector<F2LPair> result;
    std::vector<Written> turns;
    for (const Step& step : planner.best) {
        F2LPair p = {step.plan.slot, canonicalize(parseWritten(join(step.plan.turns))),
                     step.plan.extracted, false};
        p.hold = HOLDS[step.hold];
        result.push_back(p);
        turns.push_back(step.plan.turns);
    }

    // Safety Net, No Order Is Algs Throughout
    if (result.empty()) {
        CubeState state = s;
        for (int slot = 0, placed = 0; slot < SLOTS; slot++) {
            F2LPair p = planPair(state, slot, placed);
            for (Move m : p.moves) state = state.apply(m);
            placed |= 1 << slot;
            result.push_back(p);
            turns.push_back({});
            for (Move m : p.moves) turns.back().push_back(moveName(m));
        }
    }
    writeOut(result, turns);
    return result;
}

} // namespace F2L
