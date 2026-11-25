#ifndef ROTATION_H
#define ROTATION_H

#include <cstdint>
#include <string>
#include <vector>
#include "CubeState.h"

// One of the 24 ways to hold the cube
//
// The identity is the scrambling view, white up and green front. An orientation is
// the frame a solver works in: CubeState::rotate(o) rewrites a cube into that frame,
// and a solution found there is executed holding the cube as o says. Composition is
// view-relative, so identity.then(x).then(y) is "do x, then do y as you now see it"
struct Orientation {
    uint8_t id = 0;   // Index Into the Rotation Group, 0 Is Identity

    Orientation then(CubeRot r) const;
    Orientation then(const Orientation& o) const;
    Orientation inverse() const;
    bool operator==(const Orientation& o) const { return id == o.id; }
    bool operator!=(const Orientation& o) const { return id != o.id; }

    // Physical face seen at a view face, U R F D L B, which is also its colour
    int faceAt(int viewFace) const;

    static Orientation fromRotation(CubeRot r);
};

// A move made while holding the cube as o, expressed in the identity frame
Move translateMove(Move m, const Orientation& o);

// The orientation with a colour on the bottom, reached by one rotation from identity
// color: 0=white 1=red 2=green 3=yellow 4=orange 5=blue
Orientation orientationWithBottom(int color);

// Any written turn, as face turns and then the rotation it leaves the cube held in
//
// A wide or slice turn carries centres, which a CubeState has none of, so it is the
// opposite layers turned and the frame changed: r is L then x, M is R L' then x'
struct Turn {
    std::vector<Move> moves;
    Orientation after;
};

// Face, wide (r), slice (M E S) or rotation (x y z), with ' or 2
// Throws on anything else
Turn parseTurn(const std::string& s);

// A written sequence as face turns in the frame it starts from, the moves then being
// the same whether or not the cube is rotated along the way
// after, when given, gets the hold the sequence ends in
std::vector<Move> parseWritten(const std::string& s, Orientation* after = nullptr);

// Names
const char* rotationName(CubeRot r);                     // "x2"
const char* colorName(int color);                        // 0=white ... 5=blue
std::string orientationName(const Orientation& o);       // "U white  R red  ..."
std::string rotationsTo(const Orientation& o);           // "x' y", "" for Identity

#endif // ROTATION_H
