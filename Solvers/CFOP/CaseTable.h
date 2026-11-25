#ifndef CASE_TABLE_H
#define CASE_TABLE_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>
#include "../../CubeState/CubeState.h"

// An alg as a solver turns it: face, wide and slice turns and rotations, ending in the
// hold it started in
struct CaseAlgo {
    std::string name;
    std::string moves;
};

// What to do about a last layer case
// notation is the alg with its U turns, moves the same as face turns in the frame it
// starts from. All three are empty when there is nothing to do
struct Case {
    std::string name;
    std::vector<std::string> notation;
    std::vector<Move> moves;
};

// Every case of one last layer step, at every U angle
class CaseTable {
public:
    using Encode = uint32_t (*)(const CubeState&);

    // encode tells the step's cases apart. finish also lines the layer up after the alg,
    // for a step that ends the solve
    template <std::size_t N>
    void build(Encode encode, const CaseAlgo (&algs)[N], bool finish = false) {
        build(encode, algs, N, finish);
    }

    // Nothing to do for a state no alg covers
    Case find(const CubeState& s) const;
    int size() const { return table.size(); }

private:
    void build(Encode encode, const CaseAlgo* algs, std::size_t count, bool finish);
    void insert(const std::string& written, const std::string& name);

    Encode encode = nullptr;
    std::unordered_map<uint32_t, Case> table;  // Key : Case
};

#endif // CASE_TABLE_H
