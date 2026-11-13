#!/bin/sh
# build.sh: compile the libclang/LibTooling front end (nh2js-ast.cpp) against an LLVM install
# with libclang-cpp: $LLVM_PREFIX (or $LLVM), else the prefix `llvm-config --prefix` reports.
set -e
L=${LLVM_PREFIX:-${LLVM:-$(llvm-config --prefix 2>/dev/null || true)}}
if [ -z "$L" ] || [ ! -x "$L/bin/clang++" ]; then
  echo "build.sh: no LLVM found; set LLVM_PREFIX to an LLVM install with libclang-cpp" >&2
  exit 1
fi
cd "$(dirname "$0")"
OUT=${OUT:-../../../.cache/nh2js/nh2js-ast}
mkdir -p "$(dirname "$OUT")"
$L/bin/clang++ -O1 -g0 $($L/bin/llvm-config --cxxflags) -fno-rtti nh2js-ast.cpp -o "$OUT" \
  -L$L/lib -Wl,-rpath,$L/lib -lclang-cpp -lLLVM
echo "built $OUT"
