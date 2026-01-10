
import { vectorStore } from './vectorStore';
import { generateEmbedding } from './rag';
import { prisma } from './db';

interface MatchedScene {
    id: string;
    title: string;
    summary: string;
    globalSceneIndex: number;
    score: number;
    reasoning?: string;
}

interface FocusWindow {
    startGlobalIndex: number;
    endGlobalIndex: number;
    matchedScenes: MatchedScene[];
    debugInfo?: {
        intent: string;
        anchors: { scene: number, score: number }[];
        confidence: number;
        policy: string;
    };
}

const CONSTANTS = {
    SCORE_THRESHOLD: 0.72, // Stricter threshold
    MAX_WINDOW_SIZE: 40,
    PRE_CONTEXT: 20,
    POST_CONTEXT: 20
};

export const timelineService = {
    /**
     * Resolves a natural language focus (e.g., "before the attack on Winternight")
     * into a specific range of scene indices.
     */
    async resolveFocusWindow(bookId: string, focusText?: string): Promise<FocusWindow | null> {
        if (!focusText || focusText.trim() === '') {
            return null; // No restriction
        }

        console.log(`[TIMELINE] Resolving focus: "${focusText}" for book ${bookId}`);

        // 1. Generate Embedding for Focus
        const embedding = await generateEmbedding(`Time period context: ${focusText}`);

        // 2. Search Scenes in Qdrant
        // We search for 'SCENE' layer
        const results = await vectorStore.searchFragments({
            userId: 0, // Admin/Service level search, or we need to pass userId. 
            // Assuming we can pass a system user ID or fetch from book.
            // For safety, let's fetch the book's owner if 0 fails, but vectorStore might ignore userId if we relax it.
            // Actually, vectorStore searchFragments requires userId.
            // Let's first fetch the book to get userId.
            bookId,
            embedding,
            sourceType: 'BOOK',
            layer: 'SCENE',
            topK: 10 // Get enough candidates to find a cluster
        });

        // Wait, I need userId.
        const book = await prisma.book.findUnique({
            where: { id: bookId },
            select: { userId: true }
        });

        if (!book) return null;

        // Re-run search with correct userId
        const validResults = await vectorStore.searchFragments({
            userId: book.userId,
            bookId,
            embedding,
            sourceType: 'BOOK',
            layer: 'SCENE',
            topK: 12
        });

        if (validResults.length === 0) {
            console.log(`[TIMELINE] No matching scenes found for focus.`);
            return null;
        }

        // 3. Determine Window
        // Heuristic: Find the cluster of earliest matches for "before" queries, 
        // or just the spread of high-confidence matches.

        // Filter by score threshold?
        const threshold = 0.65;
        const robustMatches = validResults.filter(r => r.score > threshold);

        // If "before X", X is usually the event. We want scenes *up to* X.
        // However, standard semantic search will match X itself.
        // If the query is "before X", the embedding of X is high match.
        // The text "before X" might match scenes that logically occur before X if they contain foreshadowing,
        // but often it matches the event X itself due to keyword overlap.

        // Advanced Logic:
        // Use LLM to re-rank or interpret? "Which of these scenes corresponds to '${focusText}'?"
        // OR simpler: Take the min/max of the top matches and pad it?

        // Let's stick to simple windowing for now:
        // Top matches likely identify the anchor event. 
        // IF query contains "before", we might want 0 to min(anchor).
        // IF query contains "after", we might want max(anchor) to END.
        // IF just "during X", we want min(anchor) to max(anchor).

        const indices = validResults.map(r => r.global_scene_index || 0).sort((a, b) => a - b);

        // Simple spread
        let minIndex = indices[0];
        let maxIndex = indices[indices.length - 1];

        // "Before" / "After" Heuristic
        const lowerFocus = focusText.toLowerCase();
        if (lowerFocus.includes('before')) {
            // "Before the attack" -> Attack is arguably the end of the window.
            // Search matches "the attack".
            // So window is 0 to min(match) ?? Or 0 to max(match)?
            // Better: 0 to min(indices) - 1?
            // Safer: 0 to max(indices). "Before" usually implies the state leading up to it.
            // Let's broaden: 0 to maxIndex.
            minIndex = 0;
            // Normalize maxIndex: finding the anchor event.
            // If we have matches for "Winternight Attack", they will be scene 5, 6, 7.
            // "Before Winternight Attack" -> Scenes 0-5.
            // So we take the lowest high-score match as the *end* of the before period?
            // This is tricky without an LLM reasoning step.

            // For MVP: Return the cluster of matches +/- context.
            // Let's do simple cluster + padding.
        }

        if (lowerFocus.includes('after')) {
            // From minIndex to END
            maxIndex = 10000; // Effectively end
        }

        // Padding
        minIndex = Math.max(0, minIndex - 2);
        maxIndex = maxIndex + 2;

        console.log(`[TIMELINE] Window Resolved: ${minIndex} - ${maxIndex}`);

        return {
            startGlobalIndex: minIndex,
            endGlobalIndex: maxIndex,
            matchedScenes: validResults.map(r => ({
                id: r.id,
                title: 'Scene ' + r.global_scene_index,
                summary: r.text.substring(0, 100),
                globalSceneIndex: r.global_scene_index || 0,
                score: r.score
            }))
        };
    }
};
