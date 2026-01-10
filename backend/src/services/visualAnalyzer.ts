
import { GoogleGenerativeAI } from '@google/generative-ai';
import { vectorStore } from './vectorStore'; // Assuming this exists and exports searchFragments
import { prisma } from './db';
import {
    VisualAnalysisResult,
    VisualAttribute,
    // VisualSourceType, // Unused
    // VisualEvidence, // Unused
    AttributeValue,
    TimeState,
    Evidence,
    getTemplate,
    VISUAL_ANALYSIS_REGISTRY,
    isWeaponLike,
    WEAPON_ATTRIBUTES
} from '@merchcrafter/shared';

// --- Time State Helpers ---
const CUES_BEFORE = ["before", "previously", "used to", "once", "earlier", "formerly", "originally"];
const CUES_AFTER = ["after", "now", "currently", "later", "since", "became", "turned into", "ruined", "remains"];
const CUES_CONSTANT = ["always", "never", "constantly", "throughout", "unchanged", "permanent"];

function detectTimeState(text: string): TimeState {
    const t = text.toLowerCase();
    // Prioritize explicit cues
    if (CUES_AFTER.some(c => t.includes(c))) return 'AFTER';
    if (CUES_BEFORE.some(c => t.includes(c))) return 'BEFORE';
    if (CUES_CONSTANT.some(c => t.includes(c))) return 'CONSTANT';
    return 'UNKNOWN';
}

function normalizeAttribute(
    val: string | null | undefined,
    evidenceInput: any[],
    confidenceInput: string | number
): AttributeValue<string> {
    const lower = val?.toLowerCase() ?? '';
    const value = (val && !lower.includes('not clearly specified') && !lower.includes('not specified')) ? val : null;

    // Normalize Confidence
    let confidence = 0.5;
    if (typeof confidenceInput === 'number') confidence = confidenceInput;
    else if (confidenceInput === 'explicit') confidence = 1.0;
    else if (confidenceInput === 'inferred_from_text') confidence = 0.7;
    else if (confidenceInput === 'unknown') confidence = 0.0;

    // Hardening: Clamp confidence
    confidence = Math.max(0, Math.min(1, confidence));

    // Normalize Evidence & Detect Time State
    const evidence: Evidence[] = (evidenceInput || []).map((e: any) => {
        let loc = e.locationHint;
        if (!loc) {
            if (e.globalSceneIndex !== undefined) loc = `Scene ${e.globalSceneIndex}`;
            else if (e.fragmentIndex !== undefined) loc = `Fragment ${e.fragmentIndex}`;
        }

        return {
            quote: (typeof e.quote === 'string' && e.quote.trim().length > 0) ? e.quote : '(missing quote)',
            sourceId: (e.sourceId) ? e.sourceId : (typeof e.bookTitle === 'string' ? e.bookTitle : undefined),
            locationHint: loc as string | undefined,
            page: e.page,
            chunkId: e.chunkId
        };
    });

    // Heuristic: Check evidence quotes for time state
    let detectedState: TimeState = 'UNKNOWN';
    if (evidence.length > 0) {
        const combinedText = evidence.map(e => e.quote).join(' ');
        detectedState = detectTimeState(combinedText);
    }

    // Logic: If value is missing, confidence is 0
    if (!value) {
        confidence = 0;
        detectedState = 'UNKNOWN';
    }

    return {
        value,
        confidence,
        timeState: detectedState,
        evidence,
        notes: undefined
    };
}


// --- Attribute Categories (Strict Timeline Logic) ---

const TRAITS_PERSISTENT = [
    'hairColor',
    'hairStyleOrLength',
    'eyeColor',
    'baselineSkinTone', // Renamed from skinToneOrComplexion
    'heightOrStature',
    'buildOrBodyType',
    'ageAppearance',
    'raceOrSpeciesOrHeritage',
    'notableFacialFeatures',
    'scarsAndTattoos', // Renamed from notableBodyMarks
];

const TRAITS_CLOTHING = [
    'clothingStyleOrOutfit', // Renamed from ...TypicalOutfit
];

const TRAITS_ARMOR = [
    'armorType',
    'shieldOrActiveDefense', // Renamed from ...Protection
    'helmOrHeadgear'
];

const TRAITS_WEAPONS = [
    'primaryWeapon',
    'secondaryWeapon',
    'rangedWeapon'
];

const TRAITS_GEAR = [
    'carriedEquipment',
    'accessories'
];

const TRAITS_INJURIES = [
    'activeInjuriesOrWounds',
    'physicalCondition',
    'bloodOrGrim'
];

const TRAITS_VIBE = [
    'generalVibe', // Renamed from generalVibeOrPresence
    'emotionalState'
];

// Composite lists for initial extraction
const ATTRIBUTES_HUMANOID = [
    ...TRAITS_PERSISTENT,
    ...TRAITS_CLOTHING,
    ...TRAITS_ARMOR,
    ...TRAITS_WEAPONS,
    ...TRAITS_GEAR,
    ...TRAITS_INJURIES,
    ...TRAITS_VIBE
];

// As requested by user:
// Helper to check if a trait is strictly time-bound
const isTimeBound = (attr: string): boolean => {
    return [
        ...TRAITS_CLOTHING,
        ...TRAITS_ARMOR,
        ...TRAITS_WEAPONS,
        ...TRAITS_GEAR,
        ...TRAITS_INJURIES,
        ...TRAITS_VIBE
    ].includes(attr);
};

const ATTRIBUTES_CREATURE = [
    'bodyTypeOrSilhouette',
    'primaryColorsOrPatterns',
    'surfaceTexture',
    'sizeOrScale',
    'notableAnatomyFeatures',
    'generalVibeOrPresence'
];

// Budget Configuration
const MAX_SEARCH_PER_ATTRIBUTE = 3; // Fragments
const MAX_ATTRIBUTES_TO_REFINE = 5; // To prevent stalling

function getFragmentStats(fragments: any[]) {
    if (!fragments || fragments.length === 0) return { count: 0, min: null, max: null };
    const indices = fragments.map(f => f.global_scene_index ?? -1).filter(i => i !== -1);
    if (indices.length === 0) return { count: fragments.length, min: null, max: null };
    return {
        count: fragments.length,
        min: Math.min(...indices),
        max: Math.max(...indices)
    };
}

// Helper to normalize loose entity types from UI
function normalizeEntityType(input: string): string {
    const t = (input || '').trim().toUpperCase();

    // Common aliases from UI / older code
    const alias: Record<string, string> = { // using string here to avoid import cycle or type issues if strict enum
        ITEM: 'ITEM_OR_ARTIFACT',
        ARTIFACT: 'ITEM_OR_ARTIFACT',
        WEAPON: 'ITEM_OR_ARTIFACT',
        CREATURE: 'MONSTER_OR_CREATURE',
        MONSTER: 'MONSTER_OR_CREATURE',
        LOCATION: 'LOCATION',
        GROUP: 'GROUP_OR_FACTION_OR_ORGANIZATION',
        FACTION: 'GROUP_OR_FACTION_OR_ORGANIZATION',
        ORGANIZATION: 'GROUP_OR_FACTION_OR_ORGANIZATION',
        LANDMARK: 'LANDMARK_OR_STRUCTURE',
        STRUCTURE: 'LANDMARK_OR_STRUCTURE',
        SHIP: 'SPACE_SHIP',
        SPACESHIP: 'SPACE_SHIP',
        STATION: 'SPACE_STATION',
        ANOMALY: 'SPACE_ANOMALY',
    };

    if (alias[t]) return alias[t];

    // If it exactly matches a registry key, keep it
    if (VISUAL_ANALYSIS_REGISTRY[t]) return t;

    return 'ENTITY'; // safe generic fallback (NOT CHARACTER)
}

export async function analyzeVisualDescription(
    userId: number,
    bookIds: string[],
    entityName: string,
    entityType: string,
    focus?: string
): Promise<VisualAnalysisResult<AttributeValue<string>> | VisualAnalysisResult<VisualAttribute>> {

    const normalizedType = normalizeEntityType(entityType);

    if (!VISUAL_ANALYSIS_REGISTRY[normalizedType] && normalizedType !== 'CHARACTER') {
        console.warn(`[VisualAnalyzer] Unknown entityType "${entityType}" normalized to "${normalizedType}"`);
    }

    // --- ROUTING LOGIC ---
    // If it's a CHARACTER (or legacy dependent types if any), run the EXACT existing pipeline.
    // We will strict match CHARACTER.
    if (normalizedType === 'CHARACTER') {
        console.log(`[VisualAnalyzer] Routing DIRECT to Legacy Character Pipeline.`);
        return analyzeCharacterLegacy(userId, bookIds, entityName, normalizedType, focus);
    }

    // New Generic Path
    const template = getTemplate(normalizedType);
    console.log(`[VisualAnalyzer] Routing to Generic Pipeline (Template: ${template.entityType || 'UNKNOWN'}).`);
    return analyzeGenericEntity(userId, bookIds, entityName, normalizedType, focus, template);
}

// ---------------------------------------------------------------------------
// NEW GENERIC PIPELINE (Uses Registry Templates)
// ---------------------------------------------------------------------------
async function analyzeGenericEntity(
    userId: number,
    bookIds: string[],
    entityName: string,
    entityType: string,
    focus: string | undefined,
    template: any
): Promise<VisualAnalysisResult<AttributeValue<string>>> {
    const { generateEmbedding } = await import('./rag');
    const { timelineService } = await import('./timeline');

    // 1. Initial Retrieval (Same vector logic, just using it for generic context)
    // We can reuse the fragment retrieval logic or duplicate it to avoid touching legacy code?
    // "MAKE ZERO CHANGES to the existing... logic". Sharing a helper function is fine if I don't change the helper.
    // But the retrieval logic is inline in the original function. 
    // I will extract the retrieval logic into a helper `retrieveContext` if possible, 
    // OR just copy-paste the retrieval part to be absolutely safe (Defensive Copy).

    // -- Defensive Copy of Retrieval Logic --
    // (This ensures we don't accidentally break Character by refactoring retrieval)
    let focusWindow: { startGlobalIndex: number; endGlobalIndex: number } | null = null;
    if (focus && bookIds.length === 1) {
        focusWindow = await timelineService.resolveFocusWindow(bookIds[0], focus);
    }
    const books = await prisma.book.findMany({
        where: { id: { in: bookIds } },
        select: { id: true, title: true }
    });
    const initialQuery = `Visual appearance of ${entityName}. ${entityType}.`;
    const initialEmbedding = await generateEmbedding(initialQuery);
    let allFragments: any[] = [];

    for (const bookId of bookIds) {
        // (Skipping detailed stats logging for brevity in new path, but keeping logic)
        const globalResults = await vectorStore.searchFragments({
            userId, bookId, embedding: initialEmbedding, sourceType: 'BOOK', topK: 40
        });
        allFragments.push(...globalResults);

        if (focusWindow && bookId === bookIds[0]) {
            const localResults = await vectorStore.searchFragments({
                userId, bookId, embedding: initialEmbedding, sourceType: 'BOOK', topK: 30,
                globalSceneRange: { min: focusWindow.startGlobalIndex, max: focusWindow.endGlobalIndex }
            });
            allFragments.push(...localResults);
        }
    }
    // Dedup
    allFragments.sort((a, b) => b.score - a.score);
    const contextMap = new Map<string, any>();
    allFragments.forEach(f => contextMap.set(f.id, f));
    // -- End Retrieval --

    // 2. Extracted Attributes (Now strictly normalized)
    const extractedMap = await extractAttributesGeneric(entityName, template.attributes, Array.from(contextMap.values()), books, focus);
    let currentAttributes: Record<string, AttributeValue<string>> = extractedMap;

    // 3. Identification of Missing (Time-State Aware)
    // Helper to check quality
    // Helper to check quality
    const isPoor = (v: AttributeValue<string>) =>
        !v ||
        !v.value ||
        v.value === '' ||
        v.confidence <= 0.15 || // User specified threshold
        (v.evidence.length === 0 && v.confidence < 0.5) ||
        v.value.toLowerCase().includes('not clearly specified') ||
        v.value.toLowerCase().includes('unspecified');

    // 3. Identification of Missing Attributes
    const missingTargets: string[] = [];

    // Check Focus for time context cues to augment queries
    const timeCues = ["before", "after", "earlier", "later", "now", "pre", "post", "damaged", "ruined", "intact", "original"];
    const hasTimeContext = focus && timeCues.some(c => focus.toLowerCase().includes(c));

    for (const attr of template.attributes) {
        if (isPoor(currentAttributes[attr])) {
            missingTargets.push(attr);
        }
    }

    // Filter missingTargets for Weapon attributes on non-weapons
    let filteredTargets = missingTargets.filter(attr => {
        if (WEAPON_ATTRIBUTES.includes(attr)) {
            const detectedType = currentAttributes['itemType']?.value || '';
            return isWeaponLike(entityName, detectedType);
        }
        return true;
    });

    // TASK 5: Enforce Budget
    filteredTargets = filteredTargets.slice(0, MAX_ATTRIBUTES_TO_REFINE);

    // 4. Targeted Retrieval (Simplified)
    if (filteredTargets.length > 0) {
        const searchPromises = filteredTargets.map(async (attr) => {
            const useWindow = !!focusWindow;

            // Base Queries
            let queries: string[] = template.buildQueries
                ? template.buildQueries(entityName, attr)
                : [`${entityName} ${attr}`];

            // Augment with Time Context (One extra query)
            if (hasTimeContext && focus) {
                queries.push(`${queries[0]} ${focus}`);
            }

            // Cap queries to avoid explosion
            queries = queries.slice(0, MAX_SEARCH_PER_ATTRIBUTE); // Reusing constant for query cap as well

            if (queries.length > 0) {
                console.log(`[VisualAnalyzer] Refining ${entityName} [${attr}]:`, queries[0]);
            }

            let found: any[] = [];
            for (const q of queries) {
                try {
                    const embedding = await generateEmbedding(q);
                    for (const bookId of bookIds) {
                        const searchParams: any = {
                            userId, bookId, embedding, sourceType: 'BOOK', topK: 5
                        };
                        if (useWindow && bookId === bookIds[0]) {
                            searchParams.globalSceneRange = { min: focusWindow!.startGlobalIndex, max: focusWindow!.endGlobalIndex };
                        }
                        const results = await vectorStore.searchFragments(searchParams);
                        found.push(...results);
                    }
                } catch (e) { }
            }
            return { attr, fragments: found };
        });

        const results = await Promise.all(searchPromises);
        let addedCount = 0;
        results.forEach(({ fragments }) => {
            fragments.forEach((f: any) => {
                if (!contextMap.has(f.id)) {
                    contextMap.set(f.id, f);
                    addedCount++;
                }
            });
        });

        // 5. Re-Extraction
        if (addedCount > 0) {
            currentAttributes = await extractAttributesGeneric(entityName, template.attributes, Array.from(contextMap.values()), books, focus);
        }
    }

    const populatedCount = Object.values(currentAttributes).filter(v => !isPoor(v)).length;
    console.log(`[VisualAnalyzer] Generic Analysis Complete. Populated Attributes: ${populatedCount}/${Object.keys(currentAttributes).length}`);

    return {
        title: "Visual Description" + (focus ? ` (${focus})` : ""),
        name: entityName,
        description: generateSummaryGeneric(entityName, currentAttributes, focus),
        attributes: currentAttributes,
        contextSources: Array.from(contextMap.values()).map(f => ({
            source: books.find(b => b.id === f.book_id)?.title + (f.global_scene_index ? ` [Scene ${f.global_scene_index}]` : ''),
            summary: f.text.substring(0, 50) + "..."
        }))
    };
}

// ---------------------------------------------------------------------------
// LEGACY CHARACTER PIPELINE (PRESERVED EXACTLY)
// ---------------------------------------------------------------------------
async function analyzeCharacterLegacy(
    userId: number,
    bookIds: string[],
    entityName: string,
    entityType: string,
    focus?: string
): Promise<VisualAnalysisResult<VisualAttribute>> {

    const targetAttributes = (entityType === 'MONSTER_OR_CREATURE' || entityType === 'VEHICLE_OR_MOUNT')
        ? ATTRIBUTES_CREATURE
        : ATTRIBUTES_HUMANOID;

    // Timeline Resolution
    const { timelineService } = await import('./timeline');
    const { generateEmbedding } = await import('./rag');

    let focusWindow: { startGlobalIndex: number; endGlobalIndex: number } | null = null;
    if (focus && bookIds.length === 1) { // Multi-book focus not yet supported
        focusWindow = await timelineService.resolveFocusWindow(bookIds[0], focus);
        if (focusWindow) {
            console.log(`[VISUAL-DEBUG] Single-book focus provided. Window: [${focusWindow.startGlobalIndex}, ${focusWindow.endGlobalIndex}]`);
        } else {
            console.log(`[VISUAL-DEBUG] Single-book focus provided but Validation Failed (Null Window).`);
        }
    } else {
        if (!focus) {
            console.log(`[VISUAL-DEBUG] No focus text provided. Window: NULL`);
        } else {
            console.log(`[VISUAL-DEBUG] Multi-book mode. Timeline window disabled.`);
        }
    }

    const books = await prisma.book.findMany({
        where: { id: { in: bookIds } },
        select: { id: true, title: true }
    });

    const initialQuery = `Visual appearance of ${entityName}. ${entityType}.`;
    const initialEmbedding = await generateEmbedding(initialQuery);

    let allFragments: any[] = [];

    // 1. Initial Broad Retrieval
    // Strategy: Fetch global baseline chunks AND specific windowed chunks if focused.
    for (const bookId of bookIds) {
        // [DIAGNOSTIC] Log true book dimensions from DB
        try {
            const count = await prisma.scene.count({ where: { bookId } });

            // For min/max, we need separate aggregations or just rely on manual query if aggregate API is tricky with strict types
            // const minMax = await prisma.scene.aggregate({
            //     where: { bookId },
            //     // _min: { globalSceneIndex: true },
            //     // _max: { globalSceneIndex: true }
            // });

            console.log(`[BOOK-STATS] BookId=${bookId}`);
            console.log(`[BOOK-STATS] BookTotalScenes=${count}`);
            // console.log(`[BOOK-STATS] BookSceneIndexRange=${minMax._min.globalSceneIndex}–${minMax._max.globalSceneIndex}`);
        } catch (err) {
            console.error(`[BOOK-STATS] Failed to fetch stats for book ${bookId}`, err);
        }

        // Global Baseline Search
        await console.log(`[VISUAL-DEBUG] Baseline Search (Book ${bookId}) | Filter: NONE | TopK: 40`);
        const globalResults = await vectorStore.searchFragments({
            userId,
            bookId,
            embedding: initialEmbedding,
            sourceType: 'BOOK',
            topK: 40 // Increased from 10
        });
        const globalStats = getFragmentStats(globalResults);
        console.log(`[VISUAL-DEBUG]   -> Found ${globalStats.count} chunks. Range=[${globalStats.min}, ${globalStats.max}]`);
        allFragments.push(...globalResults);

        // Targeted Window Search (if focused)
        if (focusWindow && bookId === bookIds[0]) {
            const windowLog = `${focusWindow.startGlobalIndex} - ${focusWindow.endGlobalIndex}`;
            await console.log(`[VISUAL-DEBUG] Focused Search (Book ${bookId}) | Filter: WINDOW [${windowLog}] | TopK: 30`);

            const localResults = await vectorStore.searchFragments({
                userId,
                bookId,
                embedding: initialEmbedding,
                sourceType: 'BOOK',
                topK: 30, // Increased from 15
                globalSceneRange: { min: focusWindow.startGlobalIndex, max: focusWindow.endGlobalIndex }
            });
            const localStats = getFragmentStats(localResults);
            console.log(`[VISUAL-DEBUG]   -> Found ${localStats.count} chunks. Range=[${localStats.min}, ${localStats.max}]`);
            allFragments.push(...localResults);
        }
    }

    // Deduplicate
    allFragments.sort((a, b) => b.score - a.score);
    const contextMap = new Map<string, any>();
    allFragments.forEach(f => contextMap.set(f.id, f));

    // Log what is actually going to extraction
    const finalStats = getFragmentStats(Array.from(contextMap.values()));
    console.log(`[VISUAL-DEBUG] Final Unique Context: Count=${finalStats.count}, Range=[${finalStats.min}, ${finalStats.max}]`);

    // 2. Initial Extraction
    let currentAttributes = await extractAttributes(entityName, targetAttributes, Array.from(contextMap.values()), books, bookIds, focus, focusWindow);

    // 3. Identification of Missing/Unknown
    const missingAttributes = targetAttributes.filter(attr => {
        const val = currentAttributes[attr];
        return !val || val.sourceType === 'unknown' || val.value === '' || val.value.toLowerCase().includes('unspecified');
    });

    // 4. Targeted Retrieval
    if (missingAttributes.length > 0) {


        const searchPromises = missingAttributes.map(async (attr) => {
            const useWindow = isTimeBound(attr) && !!focusWindow;

            console.log(`[VISUAL-DEBUG] Refining Attribute: "${attr}" | Mode: ${useWindow ? 'FOCUSED (Window ' + focusWindow?.startGlobalIndex + '-' + focusWindow?.endGlobalIndex + ')' : 'BASELINE (Global)'}`);

            let queries: string[] = [];

            // Query construction logic (simplified for brevity, assume similar to before)
            const baseAttr = attr.replace(/([A-Z])/g, ' $1').toLowerCase();
            queries.push(`${entityName} ${baseAttr}`);

            let found: any[] = [];
            const topK = 5;

            for (const q of queries) {
                try {
                    const embedding = await generateEmbedding(q);
                    for (const bookId of bookIds) {
                        const searchParams: any = {
                            userId,
                            bookId,
                            embedding,
                            sourceType: 'BOOK',
                            topK
                        };

                        if (useWindow && bookId === bookIds[0]) {
                            searchParams.globalSceneRange = { min: focusWindow!.startGlobalIndex, max: focusWindow!.endGlobalIndex };
                        }

                        const results = await vectorStore.searchFragments(searchParams);
                        const rStats = getFragmentStats(results);
                        console.log(`[VISUAL-DEBUG]   -> Query "${q}" returned ${rStats.count} chunks. Range=[${rStats.min}, ${rStats.max}]`);
                        found.push(...results);
                    }
                } catch (e) { /* ignore */ }
            }
            return { attr, fragments: found };
        });

        const results = await Promise.all(searchPromises);

        // Add new fragments
        let addedCount = 0;
        results.forEach(({ fragments }) => {
            fragments.forEach((f: any) => {
                if (!contextMap.has(f.id)) {
                    contextMap.set(f.id, f);
                    addedCount++;
                }
            });
        });

        // 5. Re-Extraction
        if (addedCount > 0) {
            currentAttributes = await extractAttributes(entityName, targetAttributes, Array.from(contextMap.values()), books, bookIds, focus, focusWindow);
        }
    }

    // 6. Final Result
    // 6. Final Result (Legacy Adapter)

    console.log(`[VisualAnalyzer] Legacy Analysis Complete. Attributes: ${Object.keys(currentAttributes).length}`);

    return {
        title: "Visual Description" + (focus ? ` (${focus})` : ""),
        name: entityName,
        description: generateSummary(entityName, currentAttributes, focus),
        attributes: currentAttributes,
        contextSources: Array.from(contextMap.values()).map(f => ({
            source: books.find(b => b.id === f.book_id)?.title + (f.global_scene_index ? ` [Scene ${f.global_scene_index}]` : ''),
            summary: f.text.substring(0, 50) + "..."
        }))
    };
}


// Helper to clean JSON output
function sanitizeJsonOutput(text: string): string {
    // 1. Remove Markdown code blocks
    let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. Find first distinct '{' and last '}'
    const firstOpen = cleaned.indexOf('{');
    const lastClose = cleaned.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1 && firstOpen < lastClose) {
        cleaned = cleaned.substring(firstOpen, lastClose + 1);
    }

    return cleaned;
}

async function extractAttributes(
    entityName: string,
    attributes: string[],
    fragments: any[],
    books: any[],
    bookIds: string[],
    focus?: string,
    focusWindow?: { startGlobalIndex: number; endGlobalIndex: number } | null
): Promise<Record<string, VisualAttribute>> {
    const { llmConfig } = await import('./llmConfig');
    // Admin Model Selection: 'visualAnalysis' (mapped to 'visualAnalysis' or fallback 'analyzer')
    const config = await llmConfig.getTaskConfig('visualAnalysis');

    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({
        model: config.modelName,
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    // Prepare Context: Split into Baseline vs Focused
    let baselineText = "";
    let focusedText = "";

    fragments.forEach((f, index) => {
        const bookTitle = books.find(b => b.id === f.book_id)?.title || 'Unknown';
        const globalIdx = f.global_scene_index ?? -1;

        const isFocused = focusWindow
            ? (globalIdx >= focusWindow.startGlobalIndex && globalIdx <= focusWindow.endGlobalIndex)
            : false; // If no window, technically all is baseline, or we can treat all as baseline.

        const snippet = `[Fragment ${index}] (${bookTitle}, Scene ${globalIdx}): "${f.text}"`;

        if (isFocused) {
            focusedText += snippet + "\n\n";
        } else {
            baselineText += snippet + "\n\n";
        }
    });

    // If no window, put everything in focused logic? Or everything in baseline?
    // User wants: Baseline Traits allow ANY evidence. Focused Traits allow ONLY Focused Evidence.
    // If no window is defined, then everything is effectively Baseline, and Focused Traits are unconstrained (or should use all).
    // The prompt logic handles "If focus is provided..."
    if (!focusWindow) {
        baselineText = fragments.map((f, index) => {
            const bookTitle = books.find(b => b.id === f.book_id)?.title || 'Unknown';
            return `[Fragment ${index}] (${bookTitle}): "${f.text}"`;
        }).join('\n\n');
        focusedText = "(No Focus Window Active - Use Global Evidence)";
    }

    let focusInstruction = "";
    if (focus) {
        focusInstruction = `
    IMPORTANT - FOCUS CONTEXT: "${focus}"
    ---------------------------------------------------------
    STRICT TEMPORAL RULES:
    You must distinguish between traits that are PERMANENT (Baseline) and those that are TEMPORARY (Time-Bound).
    
    1. BASELINE TRAITS (Always Allowed):
       - Attributes: hairColor, eyeColor, buildOrBodyType, heightOrStature, raceOrSpeciesOrHeritage, generalVibe, baselineSkinTone, scarsAndTattoos.
       - You may use valid evidence from ANYWHERE in the text for these, even if it appears later in the book (e.g., "His gray eyes were cold" from a later chapter confirms his eye color).
       
    2. TIME-BOUND TRAITS (Strictly Constrained by Focus):
       - Attributes: physicalCondition (sunburn/injuries/dirt), clothingStyleOrOutfit (specific outfit), armorType, primaryWeapon.
       - ONLY include details that are true AT THIS SPECIFIC MOMENT.
       - IF FOCUS IS "BEFORE X": You MUST EXCLUDE any injuries, burns, scars, weapons, or items acquired during or after event X.
         -> Example: If focus is "Before the attack", do NOT include "burns on face" or "heron-mark blade" if those happen later.
       - If no evidence exists for the time-bound trait at this specific moment, mark it as "unknown". DO NOT fill it with future information.
    ---------------------------------------------------------
        `;
    }

    const prompt = `
    You are an expert literary analyst specializing in continuity.
    Extract detailed visual attributes for "${entityName}" based ONLY on the provided text fragments.
    ${focusInstruction}

    === STRICT OUTPUT SCHEMA ===
    Return ONLY a single valid JSON object.
    Do NOT include markdown formatting (\`\`\`json).
    Do NOT wrap the result in any key like "attributes", "result", or "${entityName}".

    Top-level keys must be EXACTLY the following attributes:
    ${attributes.join(', ')}

    Each attribute value MUST be an object with this exact structure:
    {
        "value": "short string description (or 'not clearly specified')",
        "sourceType": "explicit" | "inferred_from_text" | "unknown",
        "evidence": [
            {
                 "fragmentIndex": 12, // The number N from [Fragment N]
                 "quote": "extract from text",
                 "bookTitle": "optional",
                 "globalSceneIndex": 105 // optional
            }
        ]
    }

    HARD CONSTRAINT:
    Do NOT output flat strings for attributes. If you catch yourself doing it, rewrite the JSON so every attribute is an object.

    === EXAMPLE OUTPUT ===
    {
        "hairColor": {
            "value": "dark red with gray streaks",
            "sourceType": "explicit",
            "evidence": [
                {
                    "fragmentIndex": 12,
                    "quote": "his dark red hair, now streaked with gray",
                    "bookTitle": "My Book",
                    "globalSceneIndex": 45
                }
            ]
        },
        "eyeColor": {
            "value": "not clearly specified",
            "sourceType": "unknown",
            "evidence": []
        }
    }

    === EVIDENCE USAGE RULES ===

    1. PERSISTENT TRAITS (Identity): ${TRAITS_PERSISTENT.join(', ')}
       - You may use evidence from **ANYWHERE** (Baseline or Focused).

    2. TIME-BOUND TRAITS (Transient): ${[...TRAITS_CLOTHING, ...TRAITS_ARMOR, ...TRAITS_WEAPONS, ...TRAITS_GEAR, ...TRAITS_INJURIES, ...TRAITS_VIBE].join(', ')}
       - IF FOCUS IS ACTIVE: Use **ONLY** content in "=== EVIDENCE_FOCUSED ===". Ignore Baseline.
       - IF NO FOCUS: Use any evidence.
       - If Focused Evidence is silent for these traits, set value="not clearly specified", sourceType="unknown", evidence=[].

    === DATA ===

    === EVIDENCE_FOCUSED (Strictly within time window) ===
    ${focusedText}

    === EVIDENCE_BASELINE (Global context outside window) ===
    ${baselineText}
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        const originalText = text;

        // [LLM-RAW]
        const rawLog = {
            model: config.modelName,
            entityName,
            bookId: bookIds[0],
            focusText: focus || 'NONE',
            rawLength: text.length,
            rawPreview: text.substring(0, 1000).replace(/\n/g, '\\n')
        };
        console.log('[LLM-RAW]', JSON.stringify(rawLog));

        // Track Usage
        if (result.response.usageMetadata) {
            const { promptTokenCount, candidatesTokenCount } = result.response.usageMetadata;
            const primaryBookId = bookIds.length === 1 ? bookIds[0] : undefined;
            await llmConfig.trackUsage('visualAnalysis', promptTokenCount || 0, candidatesTokenCount || 0, primaryBookId);
        } else {
            await llmConfig.trackUsage('visualAnalysis', 0, 0);
        }

        // Sanitize
        text = sanitizeJsonOutput(text);

        let json: any = null;
        let parseErrorShort = null;
        try {
            json = JSON.parse(text);
        } catch (parseErr: any) {
            parseErrorShort = parseErr.message;
            console.error("[VisualAnalyzer] JSON Parse Failed. Raw Text:", originalText);
        }

        // [LLM-JSON-PARSED]
        console.log('[LLM-JSON-PARSED]', JSON.stringify({
            type: Array.isArray(json) ? 'array' : typeof json,
            isArray: Array.isArray(json),
            keys: (json && typeof json === 'object') ? Object.keys(json).slice(0, 50) : [],
            parsedPreview: JSON.stringify(json).substring(0, 400)
        }));

        // --- NORMALIZATION (Robust Unwrapping) ---
        let normalized = json;
        const wrappers = ['attributes', 'result', 'data', 'output', 'analysis', 'response'];
        let attempts = 0;
        const MAX_ATTEMPTS = 3; // avoid infinite loops

        while (attempts < MAX_ATTEMPTS && normalized && typeof normalized === 'object') {
            attempts++;
            let unwrapped = false;

            // 1. Array wrapper
            if (Array.isArray(normalized)) {
                if (normalized.length > 0 && typeof normalized[0] === 'object') {
                    normalized = normalized[0];
                    unwrapped = true;
                }
            }
            // 2. Known string wrapper keys
            else {
                for (const key of wrappers) {
                    if (normalized[key] && typeof normalized[key] === 'object' && !Array.isArray(normalized[key])) {
                        // mild heuristic: does it look like attributes?
                        if (Object.keys(normalized[key]).length > 0) {
                            normalized = normalized[key];
                            unwrapped = true;
                            break;
                        }
                    }
                }
            }

            // 3. Entity Name Wrapper (Dynamic - Strict Normalization)
            if (!unwrapped && !Array.isArray(normalized)) {
                const keys = Object.keys(normalized);
                // Scan all keys, not just if length === 1
                for (const key of keys) {
                    // Normalize: lowercase, remove all non-alphanumeric chars
                    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normEntity = entityName.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // Helper: Check if one strictly contains the other (e.g. "randalthor" vs "rand")
                    const isMatch = (normKey === normEntity) ||
                        (normEntity.length > 3 && normKey.includes(normEntity)) ||
                        (normKey.length > 3 && normEntity.includes(normKey));

                    if (isMatch) {
                        if (typeof normalized[key] === 'object' && !Array.isArray(normalized[key])) {
                            // Check heuristic: does the inner object have known attributes?
                            const innerContent = normalized[key];
                            const innerKeys = Object.keys(innerContent);
                            const knownAttrFound = attributes.some(attr => innerKeys.includes(attr));

                            // Fallback: check lowercase keys if strict match failed
                            const lowerInnerKeys = innerKeys.map(k => k.toLowerCase());
                            const knownAttrFoundLower = !knownAttrFound && attributes.some(attr => lowerInnerKeys.includes(attr.toLowerCase()));

                            if (knownAttrFound || knownAttrFoundLower || innerKeys.length > 2) {
                                normalized = innerContent;
                                unwrapped = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!unwrapped) break; // Stable
        }

        // [LLM-NORMALIZED]
        console.log('[LLM-NORMALIZED]', JSON.stringify({
            type: Array.isArray(normalized) ? 'array' : typeof normalized,
            keys: (normalized && typeof normalized === 'object') ? Object.keys(normalized).slice(0, 50) : [],
            preview: JSON.stringify(normalized).substring(0, 400)
        }));

        // [LLM-VALIDATED-KEYS] -- Replaces PREVIOUS "Validation Result" LOG
        const validationLog: any = {
            inputObjectKeys: (normalized && typeof normalized === 'object') ? Object.keys(normalized).slice(0, 50) : [],
            success: false,
            issues: [] as string[]
        };

        if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
            validationLog.success = false;
            validationLog.issues.push("Normalized value is not a valid object");
        } else {
            validationLog.success = true;
            if (Object.keys(normalized).length === 0) {
                console.log('[LLM-VALIDATION-WARNING] Schema succeeded but returned empty object (keys stripped or empty input).');
            }
        }
        console.log('[LLM-VALIDATION-RESULT]', JSON.stringify(validationLog));


        // Validate/Clean structure
        const cleaned: Record<string, VisualAttribute> = {};
        const mappingLog: any = { populated: [], defaulted: [] };

        if (!validationLog.success) {
            // Return failures
            attributes.forEach(attr => {
                cleaned[attr] = { value: 'not clearly specified', sourceType: 'unknown', evidence: [] };
            });
            return cleaned;
        }

        for (const attr of attributes) {
            // Case-insensitive fallback
            let raw = normalized[attr];
            if (!raw && normalized) {
                const lowerKey = Object.keys(normalized).find(k => k.toLowerCase() === attr.toLowerCase());
                if (lowerKey) raw = normalized[lowerKey];
            }

            if (raw) {
                const bestValue = (typeof raw.value === 'string') ? raw.value : (typeof raw === 'string' ? raw : ''); // Handle if LLM returns plain string instead of object
                const bestSource = (raw.sourceType && ['explicit', 'inferred_from_text', 'unknown'].includes(raw.sourceType)) ? raw.sourceType : 'unknown';

                // If LLM returned flat string: { hairColor: "Red" } -> convert to structured
                if (typeof raw === 'string') {
                    cleaned[attr] = { value: raw, sourceType: 'inferred_from_text', evidence: [] }; // Assume inferred if flat
                } else {
                    cleaned[attr] = {
                        value: bestValue,
                        sourceType: bestSource,
                        evidence: Array.isArray(raw.evidence) ? raw.evidence : []
                    };
                }

                mappingLog.populated.push(attr);
            } else {
                cleaned[attr] = { value: 'not clearly specified', sourceType: 'unknown', evidence: [] };
                mappingLog.defaulted.push({ attr, reason: 'missing_key' });
            }
        }

        // [LLM-MAP-STATUS]
        const sampleDefaulted = mappingLog.defaulted.slice(0, 3);
        console.log('[LLM-MAP-STATUS]', JSON.stringify({
            populatedCount: mappingLog.populated.length,
            defaultedCount: mappingLog.defaulted.length,
            examplesDefaulted: sampleDefaulted,
            valid: mappingLog.populated.length > 5 // Heuristic
        }));

        return cleaned;

    } catch (e: any) {
        const isNetworkError = e.message && (e.message.includes('fetch') || e.message.includes('network') || e.status === 503);
        const errorType = isNetworkError ? "Network/API Error" : "Internal Processing Error";

        console.error(`[VisualAnalyzer] Attribute Extraction Failed(${errorType}): `, e);

        // Return a safe empty structure instead of throwing 500
        const empty: Record<string, VisualAttribute> = {};
        attributes.forEach(a => empty[a] = { value: `Extraction failed: ${errorType} `, sourceType: 'unknown', evidence: [] });
        return empty;
    }
}

function generateSummary(name: string, attributes: Record<string, VisualAttribute>, focus?: string): string {
    // Gather traits
    const getVal = (k: string) => {
        const v = attributes[k];
        return (v && v.sourceType !== 'unknown' && v.value && !v.value.toLowerCase().includes('unspecified')) ? v.value : null;
    };

    const physical = TRAITS_PERSISTENT.map(k => getVal(k)).filter(Boolean).join(', ');

    // Group transient traits
    const transientLists = [TRAITS_CLOTHING, TRAITS_ARMOR, TRAITS_WEAPONS, TRAITS_GEAR, TRAITS_VIBE, TRAITS_INJURIES];
    const style = transientLists.flat().map(k => getVal(k)).filter(Boolean).join('. ');

    let summary = `${name} is described as having ${physical || 'unspecified physical features'}.`;
    if (style) {
        summary += ` ${style}.`;
    }

    if (focus) {
        summary += `\n(Analysis focused on context: "${focus}")`;
    }

    return summary;
}


// ---------------------------------------------------------------------------
// GENERIC EXTRACTION (Adapts to any attribute list)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GENERIC EXTRACTION (Updated to use new AttributeValue logic)
// ---------------------------------------------------------------------------
async function extractAttributesGeneric(
    entityName: string,
    attributes: string[],
    fragments: any[],
    books: any[],
    focus?: string
): Promise<Record<string, AttributeValue<string>>> {
    const { llmConfig } = await import('./llmConfig');
    const config = await llmConfig.getTaskConfig('visualAnalysis');
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({
        model: config.modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const contextText = fragments.map((f, index) => {
        const bookTitle = books.find(b => b.id === f.book_id)?.title || 'Unknown';
        return `[Fragment ${index}] (${bookTitle}): "${f.text}"`;
    }).join('\n\n');

    let focusInstruction = "";
    if (focus) {
        focusInstruction = `
    IMPORTANT - FOCUS CONTEXT: "${focus}"
    Prioritize details relevant to this specific moment.
        `;
    }

    const prompt = `
    You are an expert literary analyst.
    Extract detailed visual attributes for "${entityName}" based ONLY on the provided text fragments.
    ${focusInstruction}

    === STRICT OUTPUT SCHEMA ===
    Return ONLY a single valid JSON object.
    Keys must match: ${attributes.join(', ')}

    Values must be objects:
    {
        "value": "description string or 'not specified'",
        "confidence": "high" | "medium" | "low" | "none", 
        "evidence": [ 
             { "quote": "extract text", "bookTitle": "source", "fragmentIndex": number } 
        ]
    }
    
    If evidence suggests a change over time (e.g. "was blue, now red"), capture the state relevant to the FOCUS if provided, or the most current state otherwise, and include the timeline cues in the quote.

    === DATA ===
    ${contextText}
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Track Usage
        if (result.response.usageMetadata) {
            const { promptTokenCount, candidatesTokenCount } = result.response.usageMetadata;
            await llmConfig.trackUsage('visualAnalysis', promptTokenCount || 0, candidatesTokenCount || 0);
        }

        // Parse
        let json: any = {};
        try {
            json = JSON.parse(sanitizeJsonOutput(text));
        } catch (e) {
            // Fallback cleanup
            try {
                const veryClean = text.replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1');
                json = JSON.parse(veryClean);
            } catch (e2) {
                console.error("Generic JSON Parse Failed");
                // dry run
            }
        }

        const cleaned: Record<string, AttributeValue<string>> = {};
        const mappingLog: { populated: string[], defaulted: { attr: string, reason: string }[] } = {
            populated: [],
            defaulted: []
        };

        for (const attr of attributes) {
            // Case-insensitive lookup
            let raw = json[attr];
            if (!raw) {
                const lowerKey = Object.keys(json).find(k => k.toLowerCase() === attr.toLowerCase());
                if (lowerKey) raw = json[lowerKey];
            }

            if (raw) {
                const validValue = (typeof raw.value === 'string') ? raw.value : (typeof raw === 'string' ? raw : '');

                // Validation: Confidence
                let conf = 0;
                if (typeof raw.confidence === 'number') {
                    conf = Math.min(1, Math.max(0, raw.confidence));
                } else if (typeof raw.confidence === 'string') {
                    const lowerConf = raw.confidence.toLowerCase().trim();
                    if (lowerConf === 'high' || lowerConf === 'explicit') conf = 1.0;
                    else if (lowerConf === 'medium' || lowerConf === 'inferred_from_text') conf = 0.7;
                    else if (lowerConf === 'low') conf = 0.4;
                    else if (lowerConf === 'none' || lowerConf === 'unknown') conf = 0.0;
                    else conf = 0.0; // Default unknown strings to 0.0, per user instruction (Option A)
                }

                // Fallback: If value exists but confidence is missing, assume 0.5 (unless explicitly low)
                if (validValue && raw.confidence === undefined) {
                    conf = 0.5;
                }

                // Pass standardized inputs to the central normalizer
                // This recovers TimeState detection from quotes and ensures consistent evidence format
                cleaned[attr] = normalizeAttribute(
                    validValue || null,
                    Array.isArray(raw.evidence) ? raw.evidence : [],
                    conf
                );

                mappingLog.populated.push(attr);
            } else {
                cleaned[attr] = normalizeAttribute(null, [], 0);
                mappingLog.defaulted.push({ attr, reason: 'missing_key' });
            }
        }

        // --- Weapon Micro-Detail Refinement ---
        const itemType = cleaned['itemType']?.value || '';
        if (isWeaponLike(entityName, itemType) || attributes.some(a => a.startsWith('weapon') || a.startsWith('firearm'))) {
            const lowerContext = contextText.toLowerCase(); // contextText is extracted from fragments above

            // 1. Edge Type
            if (attributes.includes('weaponEdgeType')) {
                if (/(single|one|1)[-\s]?edged?/i.test(lowerContext) || /sharpened on (one|1) side/i.test(lowerContext)) {
                    cleaned['weaponEdgeType'] = { ...cleaned['weaponEdgeType'], value: 'Single-edged', confidence: 0.95, notes: 'Regex Refined' };
                } else if (/(double|two|2)[-\s]?edged?/i.test(lowerContext) || /sharpened on (both|2) sides/i.test(lowerContext)) {
                    cleaned['weaponEdgeType'] = { ...cleaned['weaponEdgeType'], value: 'Double-edged', confidence: 0.95, notes: 'Regex Refined' };
                }
            }

            // 2. Barrel Count
            if (attributes.includes('firearmBarrelCount')) {
                if (/(double|two|twin|2)[-\s]?barrels?/i.test(lowerContext)) {
                    cleaned['firearmBarrelCount'] = { ...cleaned['firearmBarrelCount'], value: '2', confidence: 0.95, notes: 'Regex Refined' };
                } else if (/(triple|three|3)[-\s]?barrels?/i.test(lowerContext)) {
                    cleaned['firearmBarrelCount'] = { ...cleaned['firearmBarrelCount'], value: '3', confidence: 0.95, notes: 'Regex Refined' };
                } else if (/(single|one|1)[-\s]?barrel/i.test(lowerContext)) {
                    cleaned['firearmBarrelCount'] = { ...cleaned['firearmBarrelCount'], value: '1', confidence: 0.95, notes: 'Regex Refined' };
                }
            }

            // 3. Action Type
            if (attributes.includes('firearmActionType')) {
                if (/bolt[-\s]?action/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Bolt Action', confidence: 0.95, notes: 'Regex Refined' };
                else if (/pump[-\s]?action/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Pump Action', confidence: 0.95, notes: 'Regex Refined' };
                else if (/lever[-\s]?action/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Lever Action', confidence: 0.95, notes: 'Regex Refined' };
                else if (/semi[-\s]?auto/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Semi-Automatic', confidence: 0.95, notes: 'Regex Refined' };
                else if (/fully?[-\s]?auto/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Automatic', confidence: 0.95, notes: 'Regex Refined' };
                else if (/revolver/i.test(lowerContext)) cleaned['firearmActionType'] = { ...cleaned['firearmActionType'], value: 'Revolver', confidence: 0.95, notes: 'Regex Refined' };
            }
        }

        return cleaned;

    } catch (e: any) {
        console.error("Generic Extraction Failed", e);
        const empty: Record<string, AttributeValue<string>> = {};
        attributes.forEach(a => empty[a] = normalizeAttribute(null, [], 0));
        return empty;
    }
}

function generateSummaryGeneric(name: string, attributes: Record<string, AttributeValue<string>>, focus?: string): string {
    const validPairs = Object.entries(attributes)
        .filter(([_, v]) => v.value && v.confidence > 0.2)
        .map(([k, v]) => `${k}: ${v.value}`);

    if (validPairs.length === 0) return `${name} has no clear visual description in the provided text.`;

    let summary = `${name} visual details:\n` + validPairs.join('\n');
    if (focus) summary += `\n(Focused on: ${focus})`;
    return summary;
}
