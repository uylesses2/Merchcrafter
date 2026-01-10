# Visual Analysis Refactor Checklist

## Purpose
Systematic refactor to separate legacy Character pipeline types (VisualAttribute) from the new Generic pipeline types (AttributeValue), ensuring safe coexistence and cleaning up the generic logic.

## Checklist

1. [x] **Fix shared type aliasing so backend legacy output compiles cleanly**
   - **Goal**: Stop type mismatches caused by redefining VisualAttribute as AttributeValue while backend legacy still uses {value, sourceType, evidence}.
   - **Files**: `shared/src/analysisTypes.ts`
   - **Steps**:
     - Remove `VisualAttribute` / `TimeStateAttribute` aliases.
     - Define `VisualAttribute` as explicit legacy structure (`{ value, sourceType, evidence }`).
     - Define `VisualSourceType` and legacy evidence shape.
     - Ensure `VisualAnalysisResult<T>` remains generic.
   - **Done when**: TypeScript compiles without mixing strict AttributeValue fields (confidence) with legacy VisualAttribute fields (sourceType) in legacy paths.
   - **Progress**: Completed in step 4145.

2. [x] **Clean up backend imports and type usage in visualAnalyzer.ts**
   - **Goal**: Remove unused imports and align types to what actually exists after Task 1.
   - **Files**: `backend/src/services/visualAnalyzer.ts`
   - **Steps**:
     - Remove unused imports (`VisualSourceType` etc if not exported or needed locally properly).
     - Align imports from `@merchcrafter/shared`.
   - **Done when**: No unused import warnings, file compiles.
   - **Progress**: Imports cleaned and signatures updated in step 4175.

3. [x] **Fix the generic “isPoor” logic and remove legacy assumptions**
   - **Goal**: Generic pipeline should not reference legacy VisualAttribute fields.
   - **Files**: `visualAnalyzer.ts` (analyzeGenericEntity)
   - **Steps**:
     - Update `isPoor` to take `AttributeValue<string>`.
     - Check: null/empty value, confidence <= 0.15, or (empty evidence AND confidence < 0.5).
     - Remove `sourceType` checks.
   - **Done when**: Generic path uses only `AttributeValue` fields.
   - **Progress**: Heuristic updated in step 4180.

4. [x] **Simplify baseline/before/after refinement**
   - **Goal**: Simplify refinement to single-state output per attribute.
   - **Files**: `visualAnalyzer.ts` (analyzeGenericEntity)
   - **Steps**:
     - Remove `missingTargets` state tracking (baseline/before/after). Only track `attr`.
     - Build queries using template + optional time-augmented query if focus context has time cues.
   - **Done when**: Refinement is deterministic, less complex.
   - **Progress**: Logic simplified in step 4190.

5. [x] **Use budget constants or remove them**
   - **Goal**: Enforce budgets.
   - **Files**: `visualAnalyzer.ts`
   - **Steps**:
     - Slice `filteredTargets` to `MAX_ATTRIBUTES_TO_REFINE`.
     - Cap query limit / fragments.
   - **Done when**: Constants are used or deleted.
   - **Progress**: Budget enforcement integrated in step 4190.

6. [x] **Fix evidence mapping consistency in normalizeAttribute()**
   - **Goal**: consistent Evidence generation.
   - **Files**: `visualAnalyzer.ts` (`normalizeAttribute`)
   - **Steps**:
     - Maps `sourceId` from `e.sourceId` or `e.bookTitle`.
     - Maps `locationHint` from `e.locationHint` or `globalSceneIndex` or `fragmentIndex`.
     - Fallback for empty quote strings.
   - **Done when**: Evidence mapping is robust.
   - **Progress**: Completed in step 4256.

7. [x] **Remove/adjust unused variables in legacy pipeline**
   - **Goal**: Clean legacy code.
   - **Files**: `visualAnalyzer.ts` (`analyzeCharacterLegacy`)
   - **Steps**:
     - Remove unused vars (e.g. `nameVariants` if unused).
   - **Done when**: No unused var warnings in legacy function.
   - **Progress**: Completed in step 4224/4251.

8. [x] **Add a minimal internal “self-check” log**
   - **Goal**: Runtime visibility.
   - **Files**: `visualAnalyzer.ts`
   - **Steps**:
     - Log routing decision (Legacy vs Generic).
     - Log count of populated attributes.
   - **Done when**: Logs appear in output.
   - **Progress**: Completed in step 4233/4251.

## Progress Log
