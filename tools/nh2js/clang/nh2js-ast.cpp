// nh2js-ast: dump the clang facts tools/nh2js needs for ONE C translation unit, as JSON.
//
//   nh2js-ast <file.c> -- <clang args...>         (writes JSON to stdout)
//
// What is dumped (see tools/nh2js/README.md, "front end"):
//   types      canonical type table (wasm32 sizes), referenced by id from every node
//   records    wasm32 record layouts of every complete struct/union seen in the TU
//   enums      enum constants (name, value) in declaration order
//   macros     every macro definition seen (name, params, body spelling, definition place)
//   invs       every macro invocation that produced tokens (name, invocation + argument places)
//   skipped    inactive preprocessor ranges of the main file
//   protos     every function declaration referenced or defined (signature)
//   decls      the main file's top-level declarations with full bodies
//
// Source locations ("loc"): a file location is {f,o} (file index, byte offset); a location
// inside a macro expansion is {x, a, s, up, sp?, pu?} describing ONE level of expansion:
//   x  = expansion entry id; a = 1 for an argument-instance entry, 0 for a macro body entry
//   s  = 1 if the token is at the start (for begin locs) / end (for end locs) of that entry
//   up = loc one level up in the expansion direction (param-use site for args, invocation for bodies)
//   sp = (args only) loc of the same token where it was spelled in the caller
//   pu = (args only) id of the param-use site (equal for begin/end <=> same argument instance)
// End locations point AFTER the last character of the last token.
#include "clang/AST/AST.h"
#include "clang/AST/ASTConsumer.h"
#include "clang/AST/RecordLayout.h"
#include "clang/AST/ParentMapContext.h"
#include "clang/Basic/SourceManager.h"
#include "clang/Frontend/CompilerInstance.h"
#include "clang/Frontend/FrontendAction.h"
#include "clang/Lex/Lexer.h"
#include "clang/Lex/MacroArgs.h"
#include "clang/Lex/MacroInfo.h"
#include "clang/Lex/PPCallbacks.h"
#include "clang/Lex/Preprocessor.h"
#include "clang/Tooling/CompilationDatabase.h"
#include "clang/Tooling/Tooling.h"
#include "llvm/Support/JSON.h"
#include "llvm/Support/raw_ostream.h"
#include <map>
#include <set>
#include <string>
#include <vector>

using namespace clang;
using llvm::json::OStream;

namespace {

struct InvRec {
  std::string name;
  const MacroInfo *mi = nullptr;
  SourceLocation nameLoc, endLoc;
  std::vector<std::pair<SourceLocation, SourceLocation>> args; // first/last token per arg
  bool hasArgs = false;
};

struct State {
  SourceManager *SM = nullptr;
  Preprocessor *PP = nullptr;
  ASTContext *Ctx = nullptr;
  std::map<unsigned, InvRec> invByOffset; // next-local-offset at MacroExpands -> invocation
  std::vector<std::pair<SourceLocation, SourceLocation>> skipped;
  std::vector<const MacroInfo *> macroDefs;
  std::map<const MacroInfo *, std::string> macroNames;
  std::map<std::string, int> files;
  std::vector<std::string> fileList;
  std::map<unsigned, int> entryIds; // FileID hash -> dense id
  std::set<unsigned> usedEntries;
  // types
  std::map<std::string, int> typeIds;   // structural key (canonical type + BigInt marks) -> id
  std::vector<QualType> typeList;       // canonical type of each id
  std::vector<int> typeSub;             // pointee / element / -1
  std::vector<int> typeBig;             // 1: an exact 64-bit integer (uint64_t/int64_t), held as BigInt
  std::vector<QualType> typeSugar;      // the first spelling seen (function types: sugared params)
  std::map<const RecordDecl *, std::string> recNames;
  std::vector<const RecordDecl *> recList;
  std::set<const RecordDecl *> recSeen;
  std::vector<const EnumDecl *> enumList;
  std::set<const EnumDecl *> enumSeen;
  std::map<const FunctionDecl *, int> protoSeen;
  std::vector<const FunctionDecl *> protoList;
  int anonCounter = 0;
};
State S;

class PPCB : public PPCallbacks {
public:
  void MacroExpands(const Token &Name, const MacroDefinition &MD, SourceRange Range,
                    const MacroArgs *Args) override {
    const MacroInfo *MI = MD.getMacroInfo();
    if (!MI) return;
    InvRec r;
    r.name = Name.getIdentifierInfo()->getName().str();
    r.mi = MI;
    r.nameLoc = Range.getBegin();
    r.endLoc = Range.getEnd();
    if (Args && MI->isFunctionLike()) {
      r.hasArgs = true;
      for (unsigned i = 0; i < Args->getNumMacroArguments(); i++) {
        const Token *t = Args->getUnexpArgument(i);
        if (t->is(tok::eof)) { r.args.push_back({SourceLocation(), SourceLocation()}); continue; }
        SourceLocation first = t->getLocation(), last = first;
        for (; t->isNot(tok::eof); t++) last = t->getLocation();
        r.args.push_back({first, last});
      }
    }
    if (MI->getNumTokens() == 0) return; // empty expansion: no SLoc entry is created
    S.invByOffset[S.SM->getNextLocalOffset()] = r;
  }
  void MacroDefined(const Token &Name, const MacroDirective *MD) override {
    const MacroInfo *MI = MD->getMacroInfo();
    S.macroDefs.push_back(MI);
    S.macroNames[MI] = Name.getIdentifierInfo()->getName().str();
  }
  void SourceRangeSkipped(SourceRange Range, SourceLocation EndifLoc) override {
    S.skipped.push_back({Range.getBegin(), EndifLoc});
  }
};

int fileIdx(FileID F) {
  OptionalFileEntryRef fe = S.SM->getFileEntryRefForID(F);
  std::string name = fe ? fe->getName().str() : std::string("<builtin>");
  auto it = S.files.find(name);
  if (it != S.files.end()) return it->second;
  int id = (int)S.fileList.size();
  S.files[name] = id;
  S.fileList.push_back(name);
  return id;
}

int entryId(FileID F) {
  unsigned h = F.getHashValue();
  auto it = S.entryIds.find(h);
  if (it != S.entryIds.end()) return it->second;
  int id = (int)S.entryIds.size();
  S.entryIds[h] = id;
  return id;
}

unsigned tokLen(SourceLocation L) {
  SourceLocation sp = S.SM->getSpellingLoc(L);
  return Lexer::MeasureTokenLength(sp, *S.SM, S.Ctx->getLangOpts());
}

void emitLoc(OStream &J, SourceLocation L, bool isEnd, int depth = 0) {
  SourceManager &SM = *S.SM;
  if (L.isInvalid() || depth > 64) { J.value(nullptr); return; }
  if (L.isFileID()) {
    auto d = SM.getDecomposedLoc(L);
    J.object([&] {
      J.attribute("f", fileIdx(d.first));
      J.attribute("o", (int64_t)(d.second + (isEnd ? tokLen(L) : 0)));
    });
    return;
  }
  FileID F = SM.getFileID(L);
  const SrcMgr::ExpansionInfo &E = SM.getSLocEntry(F).getExpansion();
  int x = entryId(F);
  S.usedEntries.insert(F.getHashValue());
  bool isArg = E.isMacroArgExpansion();
  SourceLocation m;
  // (as Lexer::isAtEndOfMacroExpansion: the end test is asked about the position after the token)
  bool at = isEnd ? SM.isAtEndOfImmediateMacroExpansion(L.getLocWithOffset(tokLen(L)), &m)
                  : SM.isAtStartOfImmediateMacroExpansion(L, &m);
  J.object([&] {
    J.attribute("x", x);
    J.attribute("a", isArg ? 1 : 0);
    J.attribute("s", at ? 1 : 0);
    if (isArg) {
      SourceLocation pu = E.getExpansionLocStart();
      J.attribute("pu", (int64_t)pu.getRawEncoding());
      J.attributeBegin("up"); emitLoc(J, pu, isEnd, depth + 1); J.attributeEnd();
      J.attributeBegin("sp"); emitLoc(J, SM.getImmediateSpellingLoc(L), isEnd, depth + 1); J.attributeEnd();
    } else {
      // offset of the token inside the macro definition body (spelling side)
      SourceLocation spl = SM.getSpellingLoc(L);
      auto d = SM.getDecomposedLoc(spl);
      J.attribute("df", fileIdx(d.first));
      J.attribute("do", (int64_t)(d.second + (isEnd ? tokLen(L) : 0)));
      J.attributeBegin("up");
      emitLoc(J, isEnd ? E.getExpansionLocEnd() : E.getExpansionLocStart(), isEnd, depth + 1);
      J.attributeEnd();
    }
  });
}

std::string recName(const RecordDecl *RD) {
  RD = RD->getDefinition() ? RD->getDefinition() : RD;
  auto it = S.recNames.find(RD);
  if (it != S.recNames.end()) return it->second;
  std::string n = RD->getName().str();
  if (n.empty()) {
    if (const TypedefNameDecl *td = RD->getTypedefNameForAnonDecl()) n = td->getName().str();
    else n = "__anon" + std::to_string(++S.anonCounter);
  }
  S.recNames[RD] = n;
  return n;
}

int typeId(QualType QT);

void noteRecord(const RecordDecl *RD) {
  if (!RD) return;
  const RecordDecl *def = RD->getDefinition();
  if (!def) return;
  if (S.recSeen.count(def)) return;
  S.recSeen.insert(def);
  for (const FieldDecl *f : def->fields()) typeId(f->getType());
  S.recList.push_back(def);
}

// uint64_t / int64_t (also through typedefs of them, e.g. uint64): after the long64 rewrite the
// canonical type is the same as `unsigned long long`, so only the typedef sugar tells them apart
bool isBigTypedef(QualType QT) {
  for (int guard = 0; guard < 16; guard++) {
    const TypedefType *TT = QT->getAs<TypedefType>();
    if (!TT) return false;
    StringRef n = TT->getDecl()->getName();
    if (n == "uint64_t" || n == "int64_t" || n == "uint_fast64_t" || n == "int_fast64_t" ||
        n == "uint_least64_t" || n == "int_least64_t") return true;
    QT = TT->getDecl()->getUnderlyingType();
  }
  return false;
}

int typeId(QualType QT) {
  QualType C = QT.getCanonicalType().getUnqualifiedType();
  const Type *T = C.getTypePtr();
  // pointers/arrays/functions are keyed by their (sugar-aware) component ids, so `uint64_t *`
  // and `unsigned long long *` are different types
  int sub = -1, big = 0;
  std::string key;
  char buf[64];
  if (const PointerType *P = QT->getAs<PointerType>()) {
    sub = typeId(P->getPointeeType());
    snprintf(buf, sizeof buf, "p%d", sub); key = buf;
  } else if (const ArrayType *A = S.Ctx->getAsArrayType(QT)) {
    sub = typeId(A->getElementType());
    long long n = -1;
    if (const ConstantArrayType *CA = dyn_cast<ConstantArrayType>(A)) n = (long long)CA->getSize().getZExtValue();
    snprintf(buf, sizeof buf, "a%d:%lld", sub, n); key = buf;
  } else if (const FunctionProtoType *F = QT->getAs<FunctionProtoType>()) {
    snprintf(buf, sizeof buf, "f%d:%d", typeId(F->getReturnType()), F->isVariadic() ? 1 : 0); key = buf;
    for (QualType p : F->getParamTypes()) { snprintf(buf, sizeof buf, ",%d", typeId(p)); key += buf; }
  } else {
    if (T->isIntegerType() && !T->isEnumeralType() && !T->isBooleanType() && isBigTypedef(QT)) big = 1;
    snprintf(buf, sizeof buf, "t%p:%d", (const void *)T, big); key = buf;
  }
  auto it = S.typeIds.find(key);
  if (it != S.typeIds.end()) return it->second;
  int id = (int)S.typeList.size();
  S.typeIds[key] = id;
  S.typeList.push_back(C);
  S.typeSub.push_back(sub);
  S.typeBig.push_back(big);
  S.typeSugar.push_back(QT);
  if (const RecordType *R = T->getAs<RecordType>()) noteRecord(R->getDecl());
  else if (const FunctionNoProtoType *F = T->getAs<FunctionNoProtoType>()) typeId(F->getReturnType());
  else if (const EnumType *E = T->getAs<EnumType>()) {
    const EnumDecl *ED = E->getDecl();
    if (ED && !S.enumSeen.count(ED)) { S.enumSeen.insert(ED); S.enumList.push_back(ED); }
  }
  return id;
}

void emitType(OStream &J, int id) {
  QualType C = S.typeList[id];
  const Type *T = C.getTypePtr();
  ASTContext &Ctx = *S.Ctx;
  J.object([&] {
    J.attribute("s", C.getAsString());
    if (T->isVoidType()) { J.attribute("k", "void"); return; }
    if (T->getAs<PointerType>()) {
      J.attribute("k", "ptr"); J.attribute("to", S.typeSub[id]); return;
    }
    if (const ArrayType *A = Ctx.getAsArrayType(C)) {
      J.attribute("k", "arr"); J.attribute("of", S.typeSub[id]);
      if (const ConstantArrayType *CA = dyn_cast<ConstantArrayType>(A)) J.attribute("n", (int64_t)CA->getSize().getZExtValue());
      else J.attribute("n", -1);
      if (A->isIncompleteType() == false) J.attribute("size", (int64_t)Ctx.getTypeSizeInChars(C).getQuantity());
      return;
    }
    if (const RecordType *R = T->getAs<RecordType>()) {
      J.attribute("k", "rec"); J.attribute("rec", recName(R->getDecl()));
      J.attribute("union", R->getDecl()->isUnion() ? 1 : 0); return;
    }
    if (const FunctionProtoType *F = S.typeSugar[id]->getAs<FunctionProtoType>()) {
      J.attribute("k", "fn"); J.attribute("ret", typeId(F->getReturnType()));
      J.attributeArray("params", [&] { for (QualType p : F->getParamTypes()) J.value(typeId(p)); });
      J.attribute("va", F->isVariadic() ? 1 : 0); return;
    }
    if (const FunctionNoProtoType *F = T->getAs<FunctionNoProtoType>()) {
      J.attribute("k", "fn"); J.attribute("ret", typeId(F->getReturnType()));
      J.attributeArray("params", [&] {}); J.attribute("va", 1); J.attribute("noproto", 1); return;
    }
    if (T->isBooleanType()) { J.attribute("k", "bool"); J.attribute("size", 1); return; }
    if (const EnumType *E = T->getAs<EnumType>()) {
      J.attribute("k", "int"); J.attribute("enum", E->getDecl()->getName().str());
      QualType I = E->getDecl()->getIntegerType();
      J.attribute("size", (int64_t)Ctx.getTypeSizeInChars(I).getQuantity());
      J.attribute("signed", I->isSignedIntegerType() ? 1 : 0); return;
    }
    if (T->isIntegerType()) {
      J.attribute("k", "int"); J.attribute("size", (int64_t)Ctx.getTypeSizeInChars(C).getQuantity());
      J.attribute("signed", T->isSignedIntegerType() ? 1 : 0);
      if (S.typeBig[id]) J.attribute("big", 1);
      return;
    }
    if (T->isRealFloatingType()) { J.attribute("k", "flt"); J.attribute("size", (int64_t)Ctx.getTypeSizeInChars(C).getQuantity()); return; }
    J.attribute("k", "other");
  });
}

// sugared name of a type when it is spelled through a typedef (coordxy, boolean, xint8, ...)
std::string sugarName(QualType QT) {
  QualType U = QT.getUnqualifiedType();
  if (const TypedefType *TT = U->getAs<TypedefType>()) {
    if (U.getTypePtr() == TT) return TT->getDecl()->getName().str();
    return TT->getDecl()->getName().str();
  }
  return "";
}

void emitRange(OStream &J, SourceRange R) {
  J.attributeBegin("b"); emitLoc(J, R.getBegin(), false); J.attributeEnd();
  J.attributeBegin("e"); emitLoc(J, R.getEnd(), true); J.attributeEnd();
}

void noteProto(const FunctionDecl *FD) {
  FD = FD->getCanonicalDecl();
  if (S.protoSeen.count(FD)) return;
  S.protoSeen[FD] = 1;
  S.protoList.push_back(FD);
  typeId(FD->getType());
}

void emitStmt(OStream &J, const Stmt *St);
void emitExtents(OStream &J, TypeSourceInfo *TSI);
void emitDecl(OStream &J, const Decl *D);

std::string declKind(const ValueDecl *VD) {
  if (isa<ParmVarDecl>(VD)) return "param";
  if (const VarDecl *V = dyn_cast<VarDecl>(VD)) {
    if (V->isStaticLocal()) return "static-local";
    if (V->isLocalVarDecl()) return V->hasExternalStorage() ? "extern-local" : "local";
    return "global";
  }
  if (isa<FunctionDecl>(VD)) return "function";
  if (isa<EnumConstantDecl>(VD)) return "enum";
  return "other";
}

void emitExprExtras(OStream &J, const Expr *E) {
  J.attribute("t", typeId(E->getType()));
  std::string sn = sugarName(E->getType());
  if (!sn.empty()) J.attribute("tn", sn);
  if (!E->isValueDependent() && E->getType()->isIntegerType() && !isa<IntegerLiteral>(E)) {
    Expr::EvalResult R;
    if (E->isIntegerConstantExpr(*S.Ctx) && E->EvaluateAsInt(R, *S.Ctx)) J.attribute("cv", llvm::toString(R.Val.getInt(), 10));
  }
}

void emitStmt(OStream &J, const Stmt *St) {
  if (!St) { J.value(nullptr); return; }
  J.object([&] {
    J.attribute("k", St->getStmtClassName());
    emitRange(J, St->getSourceRange());
    if (const Expr *E = dyn_cast<Expr>(St)) emitExprExtras(J, E);
    if (const BinaryOperator *B = dyn_cast<BinaryOperator>(St)) {
      J.attribute("op", BinaryOperator::getOpcodeStr(B->getOpcode()).str());
      J.attributeBegin("ol"); emitLoc(J, B->getOperatorLoc(), false); J.attributeEnd();
      if (const CompoundAssignOperator *C = dyn_cast<CompoundAssignOperator>(B)) {
        J.attribute("clt", typeId(C->getComputationLHSType()));
        J.attribute("crt", typeId(C->getComputationResultType()));
      }
    } else if (const UnaryOperator *U = dyn_cast<UnaryOperator>(St)) {
      J.attribute("op", UnaryOperator::getOpcodeStr(U->getOpcode()).str());
      J.attribute("post", U->isPostfix() ? 1 : 0);
    } else if (const CastExpr *C = dyn_cast<CastExpr>(St)) {
      J.attribute("ck", C->getCastKindName());
      if (const ExplicitCastExpr *X = dyn_cast<ExplicitCastExpr>(C)) {
        J.attribute("tw", typeId(X->getTypeAsWritten()));
        std::string sn = sugarName(X->getTypeAsWritten());
        if (!sn.empty()) J.attribute("twn", sn);
      }
    } else if (const DeclRefExpr *D = dyn_cast<DeclRefExpr>(St)) {
      const ValueDecl *VD = D->getDecl();
      J.attribute("name", VD->getName().str());
      J.attribute("ref", (int64_t)(uintptr_t)VD->getCanonicalDecl());
      J.attribute("dk", declKind(VD));
      if (const FunctionDecl *FD = dyn_cast<FunctionDecl>(VD)) noteProto(FD);
      if (const EnumConstantDecl *EC = dyn_cast<EnumConstantDecl>(VD)) {
        J.attribute("ev", llvm::toString(EC->getInitVal(), 10));
        if (const EnumDecl *ED = dyn_cast<EnumDecl>(EC->getDeclContext()))
          if (!S.enumSeen.count(ED)) { S.enumSeen.insert(ED); S.enumList.push_back(ED); }
      }
      if (const VarDecl *V = dyn_cast<VarDecl>(VD)) {
        typeId(V->getType());
        J.attribute("vt", typeId(V->getType()));
        // an array's written extent from any declaration of it (extern char tune[6] in decl.h)
        if (V->getType()->isArrayType() && !V->isLocalVarDeclOrParm()) {
          for (const VarDecl *R : V->redecls()) {
            TypeSourceInfo *TSI = R->getTypeSourceInfo();
            if (!TSI) continue;
            auto AL = TSI->getTypeLoc().getAs<ArrayTypeLoc>();
            if (AL && AL.getSizeExpr()) { emitExtents(J, TSI); break; }
          }
        }
        if (V->isStaticLocal() || V->isFileVarDecl()) {
          if (const FunctionDecl *P = dyn_cast_or_null<FunctionDecl>(V->getDeclContext())) J.attribute("owner", P->getName().str());
          J.attribute("static", V->getStorageClass() == SC_Static ? 1 : 0);
        }
      }
    } else if (const MemberExpr *M = dyn_cast<MemberExpr>(St)) {
      const ValueDecl *MD = M->getMemberDecl();
      J.attribute("name", MD->getName().str());
      J.attribute("arrow", M->isArrow() ? 1 : 0);
      J.attributeBegin("ml"); emitLoc(J, M->getMemberLoc(), false); J.attributeEnd();
      if (const FieldDecl *F = dyn_cast<FieldDecl>(MD)) {
        J.attribute("rec", recName(F->getParent()));
        noteRecord(F->getParent());
        if (F->isBitField()) J.attribute("bits", (int64_t)F->getBitWidthValue());
        J.attribute("ft", typeId(F->getType()));
        std::string sn = sugarName(F->getType());
        if (!sn.empty()) J.attribute("ftn", sn);
      }
    } else if (const IntegerLiteral *I = dyn_cast<IntegerLiteral>(St)) {
      J.attribute("v", llvm::toString(I->getValue(), 10, I->getType()->isSignedIntegerType()));
    } else if (const CharacterLiteral *Ch = dyn_cast<CharacterLiteral>(St)) {
      J.attribute("v", (int64_t)Ch->getValue());
    } else if (const FloatingLiteral *Fl = dyn_cast<FloatingLiteral>(St)) {
      J.attribute("v", Fl->getValueAsApproximateDouble());
    } else if (const StringLiteral *SL = dyn_cast<StringLiteral>(St)) {
      std::string bytes;
      if (SL->getCharByteWidth() == 1) bytes = SL->getBytes().str();
      // bytes as an array of numbers (exact, no escaping questions)
      J.attributeArray("bytes", [&] { for (unsigned char c : bytes) J.value((int64_t)c); });
      J.attribute("toks", (int64_t)SL->getNumConcatenated());
      J.attributeArray("tl", [&] {
        for (unsigned i = 0; i < SL->getNumConcatenated(); i++) emitLoc(J, SL->getStrTokenLoc(i), false);
      });
    } else if (const UnaryExprOrTypeTraitExpr *U = dyn_cast<UnaryExprOrTypeTraitExpr>(St)) {
      J.attribute("trait", U->getKind() == UETT_SizeOf ? "sizeof" : "alignof");
      if (U->isArgumentType()) {
        J.attribute("at", typeId(U->getArgumentType()));
        std::string sn = sugarName(U->getArgumentType());
        if (!sn.empty()) J.attribute("atn", sn);
      }
    } else if (const LabelStmt *L = dyn_cast<LabelStmt>(St)) {
      J.attribute("name", L->getName());
    } else if (const GotoStmt *G = dyn_cast<GotoStmt>(St)) {
      J.attribute("name", G->getLabel()->getName().str());
    } else if (const CallExpr *CE = dyn_cast<CallExpr>(St)) {
      if (const FunctionDecl *FD = CE->getDirectCallee()) { J.attribute("callee", FD->getName().str()); noteProto(FD); }
    } else if (const InitListExpr *IL = dyn_cast<InitListExpr>(St)) {
      if (IL->hasArrayFiller()) { J.attributeBegin("filler"); emitStmt(J, IL->getArrayFiller()); J.attributeEnd(); }
      if (const FieldDecl *F = IL->getInitializedFieldInUnion()) J.attribute("ufield", F->getName().str());
    } else if (const PredefinedExpr *P = dyn_cast<PredefinedExpr>(St)) {
      J.attribute("name", PredefinedExpr::getIdentKindName(P->getIdentKind()).str());
    } else if (const OffsetOfExpr *O = dyn_cast<OffsetOfExpr>(St)) {
      J.attributeArray("comps", [&] {
        for (unsigned i = 0; i < O->getNumComponents(); i++) {
          const OffsetOfNode &N = O->getComponent(i);
          if (N.getKind() == OffsetOfNode::Field) J.value(N.getField()->getName().str());
          else J.value(nullptr);
        }
      });
      J.attribute("at", typeId(O->getTypeSourceInfo()->getType()));
    }
    if (const DeclStmt *DS = dyn_cast<DeclStmt>(St)) {
      J.attributeArray("decls", [&] { for (const Decl *D : DS->decls()) emitDecl(J, D); });
      return;
    }
    // children (InitListExpr: semantic form, nulls kept so indices line up)
    J.attributeArray("c", [&] {
      if (const InitListExpr *IL = dyn_cast<InitListExpr>(St)) {
        for (unsigned i = 0; i < IL->getNumInits(); i++) emitStmt(J, IL->getInit(i));
        return;
      }
      if (const UnaryExprOrTypeTraitExpr *U = dyn_cast<UnaryExprOrTypeTraitExpr>(St)) {
        if (!U->isArgumentType()) emitStmt(J, U->getArgumentExpr());
        return;
      }
      for (const Stmt *C : St->children()) emitStmt(J, C);
    });
  });
}

// array extents as written (outermost first), e.g. char name[PL_NSIZ] -> [PL_NSIZ]
void emitExtents(OStream &J, TypeSourceInfo *TSI) {
  if (!TSI) return;
  TypeLoc TL = TSI->getTypeLoc();
  std::vector<const Expr *> ext;
  for (;;) {
    if (auto AL = TL.getAs<ArrayTypeLoc>()) { ext.push_back(AL.getSizeExpr()); TL = AL.getElementLoc(); continue; }
    if (auto PL = TL.getAs<ParenTypeLoc>()) { TL = PL.getInnerLoc(); continue; }
    // through pointers too: `enum statusfields (*fieldorder)[MAX_PER_ROW]` -> [MAX_PER_ROW]
    // (the list is the array extents in the order the type nests them)
    if (auto PT = TL.getAs<PointerTypeLoc>()) { TL = PT.getPointeeLoc(); continue; }
    if (auto QL = TL.getAs<QualifiedTypeLoc>()) { TL = QL.getUnqualifiedLoc(); continue; }
    break;
  }
  if (ext.empty()) return;
  J.attributeArray("ext", [&] { for (const Expr *E : ext) emitStmt(J, E); });
}

void emitFieldList(OStream &J, const RecordDecl *RD) {
  const ASTRecordLayout &L = S.Ctx->getASTRecordLayout(RD);
  J.attributeArray("fields", [&] {
    unsigned i = 0;
    for (const FieldDecl *F : RD->fields()) {
      J.object([&] {
        std::string n = F->getName().str();
        J.attribute("name", n);
        J.attribute("t", typeId(F->getType()));
        std::string sn = sugarName(F->getType());
        if (!sn.empty()) J.attribute("tn", sn);
        J.attribute("bitoff", (int64_t)L.getFieldOffset(i));
        if (F->isBitField()) {
          J.attribute("bits", (int64_t)F->getBitWidthValue());
          J.attributeBegin("bw"); emitStmt(J, F->getBitWidth()); J.attributeEnd();
        }
        emitRange(J, F->getSourceRange());
        emitExtents(J, F->getTypeSourceInfo());
      });
      i++;
    }
  });
}

void emitDecl(OStream &J, const Decl *D) {
  J.object([&] {
    J.attribute("k", D->getDeclKindName());
    emitRange(J, D->getSourceRange());
    J.attributeBegin("l"); emitLoc(J, D->getLocation(), false); J.attributeEnd();
    if (const NamedDecl *ND = dyn_cast<NamedDecl>(D)) J.attribute("name", ND->getName().str());
    if (const FunctionDecl *FD = dyn_cast<FunctionDecl>(D)) {
      noteProto(FD);
      J.attribute("t", typeId(FD->getType()));
      J.attribute("static", FD->getStorageClass() == SC_Static ? 1 : 0);
      J.attribute("va", FD->isVariadic() ? 1 : 0);
      J.attribute("ret", typeId(FD->getReturnType()));
      std::string sn = sugarName(FD->getReturnType());
      if (!sn.empty()) J.attribute("retn", sn);
      J.attributeArray("params", [&] { for (const ParmVarDecl *P : FD->parameters()) emitDecl(J, P); });
      if (FD->doesThisDeclarationHaveABody()) { J.attributeBegin("body"); emitStmt(J, FD->getBody()); J.attributeEnd(); }
      return;
    }
    if (const VarDecl *V = dyn_cast<VarDecl>(D)) {
      J.attribute("id", (int64_t)(uintptr_t)V->getCanonicalDecl());
      J.attribute("t", typeId(V->getType()));
      std::string sn = sugarName(V->getType());
      if (!sn.empty()) J.attribute("tn", sn);
      J.attribute("sc", V->getStorageClass() == SC_Static ? "static" : V->getStorageClass() == SC_Extern ? "extern" : "none");
      J.attribute("staticLocal", V->isStaticLocal() ? 1 : 0);
      J.attribute("fileScope", V->isFileVarDecl() ? 1 : 0);
      J.attribute("isDef", V->isThisDeclarationADefinition() == VarDecl::Definition ? 1 : V->isThisDeclarationADefinition() == VarDecl::TentativeDefinition ? 2 : 0);
      // array extent as written (for sizeof and stack allocation): source range of the size expr
      emitExtents(J, V->getTypeSourceInfo());
      if (V->hasInit()) { J.attributeBegin("init"); emitStmt(J, V->getInit()); J.attributeEnd(); }
      return;
    }
    if (const RecordDecl *RD = dyn_cast<RecordDecl>(D)) {
      J.attribute("rec", recName(RD));
      J.attribute("union", RD->isUnion() ? 1 : 0);
      J.attribute("complete", RD->isCompleteDefinition() ? 1 : 0);
      if (RD->isCompleteDefinition()) noteRecord(RD);
      return;
    }
    if (const EnumDecl *ED = dyn_cast<EnumDecl>(D)) {
      if (!S.enumSeen.count(ED)) { S.enumSeen.insert(ED); S.enumList.push_back(ED); }
      return;
    }
    if (const TypedefNameDecl *TD = dyn_cast<TypedefNameDecl>(D)) {
      J.attribute("t", typeId(TD->getUnderlyingType()));
      return;
    }
  });
}

class Consumer : public ASTConsumer {
public:
  std::string mainName;
  void HandleTranslationUnit(ASTContext &Ctx) override {
    S.Ctx = &Ctx;
    SourceManager &SM = Ctx.getSourceManager();
    FileID mainF = SM.getMainFileID();
    fileIdx(mainF);
    OStream J(llvm::outs());
    J.object([&] {
      J.attribute("main", mainName);
      J.attributeArray("decls", [&] {
        for (const Decl *D : Ctx.getTranslationUnitDecl()->decls()) {
          SourceLocation L = SM.getExpansionLoc(D->getLocation());
          if (SM.getFileID(L) != mainF) {
            // functions a project header defines (sfmacros.h: SF_C(struct, arti_info) defines
            // sfo_arti_info/sfi_arti_info in every TU including it with SF_C defined) are part
            // of this TU too; system-header inlines (__isspace) belong to the C library
            // (and file-scope data a project header defines: artilist[] in artilist.h)
            const FunctionDecl *FD = dyn_cast<FunctionDecl>(D);
            const VarDecl *VD = dyn_cast<VarDecl>(D);
            bool fnDef = FD && FD->doesThisDeclarationHaveABody();
            bool varDef = VD && VD->isThisDeclarationADefinition() == VarDecl::Definition && VD->hasInit();
            if ((!fnDef && !varDef) || SM.isInSystemHeader(L)) continue;
          }
          emitDecl(J, D);
        }
      });
      J.attributeArray("protos", [&] {
        for (size_t i = 0; i < S.protoList.size(); i++) {
          const FunctionDecl *FD = S.protoList[i];
          J.object([&] {
            J.attribute("name", FD->getName().str());
            J.attribute("t", typeId(FD->getType()));
            J.attribute("static", FD->getStorageClass() == SC_Static ? 1 : 0);
            const FunctionDecl *Def = FD->getDefinition();
            J.attribute("defined", Def ? 1 : 0);
            J.attributeArray("pn", [&] { for (const ParmVarDecl *P : FD->parameters()) J.value(P->getName().str()); });
            J.attributeArray("ptn", [&] { for (const ParmVarDecl *P : FD->parameters()) J.value(sugarName(P->getType())); });
            J.attribute("retn", sugarName(FD->getReturnType()));
            {
              // where it is declared: the C library, Lua, or the game/host
              SourceLocation dl = SM.getExpansionLoc(FD->getLocation());
              if (dl.isValid()) J.attribute("file", S.fileList[fileIdx(SM.getFileID(dl))]);
            }
            if (const FormatAttr *FA = FD->getAttr<FormatAttr>()) {
              J.attribute("fmt", (int64_t)FA->getFormatIdx());
              J.attribute("fa", (int64_t)FA->getFirstArg());
            }
          });
        }
      });
      J.attributeArray("typedefs", [&] {
        for (const Decl *D : Ctx.getTranslationUnitDecl()->decls()) {
          const TypedefNameDecl *TD = dyn_cast<TypedefNameDecl>(D);
          if (!TD) continue;
          SourceLocation dl = SM.getExpansionLoc(TD->getLocation());
          if (dl.isInvalid()) continue;
          J.object([&] {
            J.attribute("name", TD->getName().str());
            J.attribute("t", typeId(TD->getUnderlyingType()));
            std::string sn = sugarName(TD->getUnderlyingType());
            if (!sn.empty()) J.attribute("tn", sn);
            J.attribute("file", S.fileList[fileIdx(SM.getFileID(dl))]);
            J.attribute("line", (int64_t)SM.getExpansionLineNumber(dl));
            emitRange(J, TD->getSourceRange());
            emitExtents(J, TD->getTypeSourceInfo());
          });
        }
      });
      // records: layouts (types may add records while iterating: index loop)
      J.attributeArray("records", [&] {
        for (size_t i = 0; i < S.recList.size(); i++) {
          const RecordDecl *RD = S.recList[i];
          const ASTRecordLayout &L = Ctx.getASTRecordLayout(RD);
          J.object([&] {
            J.attribute("name", recName(RD));
            J.attribute("union", RD->isUnion() ? 1 : 0);
            J.attribute("size", (int64_t)L.getSize().getQuantity());
            J.attribute("align", (int64_t)L.getAlignment().getQuantity());
            SourceLocation dl = SM.getExpansionLoc(RD->getLocation());
            J.attribute("file", S.fileList[fileIdx(SM.getFileID(dl))]);
            J.attribute("line", (int64_t)SM.getExpansionLineNumber(dl));
            J.attribute("fi", fileIdx(SM.getFileID(dl)));
            emitRange(J, RD->getSourceRange());
            if (const TypedefNameDecl *td = RD->getTypedefNameForAnonDecl()) J.attribute("typedef", td->getName().str());
            J.attribute("tag", RD->getName().str());
            emitFieldList(J, RD);
          });
        }
      });
      J.attributeArray("enums", [&] {
        for (size_t i = 0; i < S.enumList.size(); i++) {
          const EnumDecl *ED = S.enumList[i];
          J.object([&] {
            J.attribute("name", ED->getName().str());
            SourceLocation dl = SM.getExpansionLoc(ED->getLocation());
            J.attribute("file", S.fileList[fileIdx(SM.getFileID(dl))]);
            J.attribute("fi", fileIdx(SM.getFileID(dl)));
            emitRange(J, ED->getSourceRange());
            J.attributeArray("consts", [&] {
              for (const EnumConstantDecl *EC : ED->enumerators()) {
                J.object([&] {
                  J.attribute("name", EC->getName().str());
                  J.attribute("v", llvm::toString(EC->getInitVal(), 10));
                  J.attribute("explicit", EC->getInitExpr() ? 1 : 0);
                  if (EC->getInitExpr()) { J.attributeBegin("init"); emitStmt(J, EC->getInitExpr()); J.attributeEnd(); }
                  SourceLocation el = SM.getExpansionLoc(EC->getLocation());
                  J.attribute("line", (int64_t)SM.getExpansionLineNumber(el));
                  J.attribute("file", S.fileList[fileIdx(SM.getFileID(el))]);
                  emitRange(J, EC->getSourceRange());
                });
              }
            });
          });
        }
      });
      J.attributeArray("types", [&] { for (size_t i = 0; i < S.typeList.size(); i++) emitType(J, (int)i); });
      J.attributeArray("invs", [&] {
        // walk all local SLoc entries; report body expansions that we referenced
        for (unsigned i = 0; i < SM.local_sloc_entry_size(); i++) {
          const SrcMgr::SLocEntry &E = SM.getLocalSLocEntry(i);
          if (!E.isExpansion()) continue;
          const SrcMgr::ExpansionInfo &X = E.getExpansion();
          if (X.isMacroArgExpansion()) continue;
          auto it = S.invByOffset.find(E.getOffset());
          SourceLocation L = SourceLocation::getFromRawEncoding(E.getOffset());
          FileID F = SM.getFileID(L);
          if (!S.usedEntries.count(F.getHashValue())) continue;
          J.object([&] {
            J.attribute("x", entryId(F));
            if (it != S.invByOffset.end()) {
              InvRec &r = it->second;
              J.attribute("name", r.name);
              J.attribute("fn", r.mi->isFunctionLike() ? 1 : 0);
              J.attributeArray("params", [&] { for (const IdentifierInfo *p : r.mi->params()) J.value(p->getName().str()); });
              SourceLocation dl = r.mi->getDefinitionLoc();
              J.attribute("dfile", S.fileList[fileIdx(SM.getFileID(SM.getSpellingLoc(dl)))]);
              J.attribute("doff", (int64_t)SM.getDecomposedLoc(SM.getSpellingLoc(dl)).second);
              if (r.hasArgs) {
                J.attributeArray("args", [&] {
                  for (auto &a : r.args) {
                    if (a.first.isInvalid()) { J.value(nullptr); continue; }
                    J.object([&] {
                      J.attributeBegin("b"); emitLoc(J, a.first, false); J.attributeEnd();
                      J.attributeBegin("e"); emitLoc(J, a.second, true); J.attributeEnd();
                    });
                  }
                });
              }
            } else {
              J.attribute("name", Lexer::getImmediateMacroName(L, SM, Ctx.getLangOpts()).str());
              J.attribute("builtin", 1);
            }
            J.attributeBegin("b"); emitLoc(J, X.getExpansionLocStart(), false); J.attributeEnd();
            J.attributeBegin("e"); emitLoc(J, X.getExpansionLocEnd(), true); J.attributeEnd();
          });
        }
      });
      J.attributeArray("macros", [&] {
        for (const MacroInfo *MI : S.macroDefs) {
          SourceLocation dl = SM.getSpellingLoc(MI->getDefinitionLoc());
          if (dl.isInvalid() || !dl.isFileID()) continue;
          FileID F = SM.getFileID(dl);
          OptionalFileEntryRef fe = SM.getFileEntryRefForID(F);
          if (!fe) continue;
          J.object([&] {
            J.attribute("name", S.macroNames[MI]);
            J.attribute("file", S.fileList[fileIdx(F)]);
            J.attribute("off", (int64_t)SM.getDecomposedLoc(dl).second);
            J.attribute("end", (int64_t)SM.getDecomposedLoc(SM.getSpellingLoc(MI->getDefinitionEndLoc())).second +
                                   (int64_t)tokLen(MI->getDefinitionEndLoc()));
            J.attribute("fn", MI->isFunctionLike() ? 1 : 0);
            J.attribute("va", MI->isVariadic() ? 1 : 0);
            J.attributeArray("params", [&] { for (const IdentifierInfo *p : MI->params()) J.value(p->getName().str()); });
            std::string body;
            for (const Token &T : MI->tokens()) {
              if (!body.empty() && T.hasLeadingSpace()) body += ' ';
              body += S.PP->getSpelling(T);
            }
            J.attribute("body", body);
          });
        }
      });
      J.attributeArray("skipped", [&] {
        for (auto &r : S.skipped) {
          // (every file's inactive regions: headers are spliced from too)
          J.object([&] {
            J.attribute("f", fileIdx(SM.getFileID(r.first)));
            J.attribute("b", (int64_t)SM.getDecomposedLoc(r.first).second);
            J.attribute("e", (int64_t)SM.getDecomposedLoc(r.second).second);
          });
        }
      });
      J.attributeArray("files", [&] { for (auto &f : S.fileList) J.value(f); });
    });
    llvm::outs() << "\n";
  }
};

class Action : public ASTFrontendAction {
public:
  std::unique_ptr<ASTConsumer> CreateASTConsumer(CompilerInstance &CI, StringRef file) override {
    S.SM = &CI.getSourceManager();
    S.PP = &CI.getPreprocessor();
    CI.getPreprocessor().addPPCallbacks(std::make_unique<PPCB>());
    auto c = std::make_unique<Consumer>();
    c->mainName = file.str();
    return c;
  }
};

} // namespace

int main(int argc, const char **argv) {
  std::vector<std::string> args;
  std::string file;
  int i = 1;
  for (; i < argc && std::string(argv[i]) != "--"; i++) file = argv[i];
  for (i++; i < argc; i++) args.push_back(argv[i]);
  tooling::FixedCompilationDatabase db(".", args);
  tooling::ClangTool tool(db, {file});
  tool.setDiagnosticConsumer(new IgnoringDiagConsumer());
  return tool.run(tooling::newFrontendActionFactory<Action>().get());
}
