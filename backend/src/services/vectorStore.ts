import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

export interface BookFragment {
    id: string; // UUID
    text: string;
    embedding: number[];
    book_id: string;
    user_id: number;
    source_type: 'BOOK' | 'WEB';
    layer?: 'CHUNK' | 'SNIPPET' | 'SCENE'; // Layer differentiation
    entity_names?: string[];
    labels?: string[];
    chapter_index?: number;
    scene_index?: number;
    global_scene_index?: number;
    start_char?: number;
    end_char?: number;
    page_number?: number;
    position_index?: number;
    temporal_hints?: string[]; // JSON string array
}

const COLLECTION_NAME = 'book_fragments';
const VECTOR_SIZE = 768; // text-embedding-004

class QdrantVectorStore {
    private client: QdrantClient;

    constructor() {
        this.client = new QdrantClient({
            url: config.QDRANT_URL,
            apiKey: config.QDRANT_API_KEY,
        });
    }

    async init() {
        try {
            console.log(`[QDRANT] Connecting to ${config.QDRANT_URL}...`);
            const result = await this.client.getCollections();
            const exists = result.collections.some(c => c.name === COLLECTION_NAME);

            if (!exists) {
                console.log(`[QDRANT] Collection '${COLLECTION_NAME}' not found. Creating...`);
                await this.client.createCollection(COLLECTION_NAME, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine',
                    },
                });
                console.log(`[QDRANT] Collection '${COLLECTION_NAME}' created.`);
            } else {
                console.log(`[QDRANT] Collection '${COLLECTION_NAME}' exists.`);
            }
        } catch (err: any) {
            console.error(`[QDRANT ERROR] Initialization failed. Is Qdrant running?`, err.message);
        }
    }

    async upsertFragments(fragments: BookFragment[]) {
        if (fragments.length === 0) return;

        try {
            const points = fragments.map(f => ({
                id: f.id,
                vector: f.embedding,
                payload: {
                    text: f.text,
                    book_id: f.book_id,
                    user_id: f.user_id,
                    source_type: f.source_type,
                    layer: f.layer || 'CHUNK',
                    entity_names: f.entity_names || [],
                    labels: f.labels || [],
                    chapter_index: f.chapter_index,
                    scene_index: f.scene_index,
                    global_scene_index: f.global_scene_index,
                    start_char: f.start_char,
                    end_char: f.end_char,
                    page_number: f.page_number,
                    position_index: f.position_index,
                    temporal_hints: f.temporal_hints || []
                }
            }));

            await this.client.upsert(COLLECTION_NAME, {
                wait: true,
                points
            });

            console.log(`[QDRANT] Upserted ${fragments.length} fragments (Layer: ${fragments[0].layer || 'CHUNK'}).`);
        } catch (err: any) {
            console.error(`[QDRANT ERROR] Upsert failed: ${err.message}`);
            throw err;
        }
    }

    async deleteBookFragments(bookId: string) {
        try {
            await this.client.delete(COLLECTION_NAME, {
                wait: true,
                filter: {
                    must: [
                        { key: 'book_id', match: { value: bookId } }
                    ]
                }
            });
            console.log(`[QDRANT] Deleted fragments for book ${bookId}`);
        } catch (err: any) {
            console.error(`[QDRANT ERROR] Delete failed: ${err.message}`);
            // Don't throw, allow SQL delete to proceed
        }
    }

    async searchFragments(params: {
        userId: number;
        bookId: string;
        embedding: number[];
        sourceType?: 'BOOK' | 'WEB';
        layer?: 'CHUNK' | 'SNIPPET' | 'SCENE';
        entityNames?: string[];
        labels?: string[];
        topK?: number;
        globalSceneRange?: { min: number; max: number };
    }) {
        const {
            userId,
            bookId,
            embedding,
            sourceType = 'BOOK',
            layer,
            entityNames = [],
            labels = [],
            topK = 50,
            globalSceneRange
        } = params;

        try {
            const filterConditions: any[] = [
                { key: 'book_id', match: { value: bookId } },
                { key: 'user_id', match: { value: userId } },
                { key: 'source_type', match: { value: sourceType } }
            ];

            // Layer Filter
            if (layer) {
                filterConditions.push({ key: 'layer', match: { value: layer } });
            }

            const mustChecks = filterConditions.map(c => ({
                key: c.key,
                match: c.match
            }));

            if (entityNames.length > 0) {
                mustChecks.push({
                    key: 'entity_names',
                    match: { any: entityNames }
                } as any);
            }

            if (labels.length > 0) {
                mustChecks.push({
                    key: 'labels',
                    match: { any: labels }
                } as any);
            }

            if (globalSceneRange) {
                mustChecks.push({
                    key: 'global_scene_index',
                    range: {
                        gte: globalSceneRange.min,
                        lte: globalSceneRange.max
                    }
                } as any);
            }

            const searchResult = await this.client.search(COLLECTION_NAME, {
                vector: embedding,
                limit: topK,
                filter: {
                    must: mustChecks
                },
                with_payload: true
            });

            return searchResult.map(hit => {
                const p = hit.payload as any;
                return {
                    id: hit.id as string,
                    text: p.text as string,
                    score: hit.score,
                    book_id: p.book_id,
                    user_id: p.user_id,
                    source_type: p.source_type,
                    layer: p.layer,
                    entity_names: p.entity_names,
                    labels: p.labels,
                    page_number: p.page_number,
                    global_scene_index: p.global_scene_index,
                    chapter_index: p.chapter_index,
                    temporal_hints: p.temporal_hints
                };
            });

        } catch (err: any) {
            console.error(`[QDRANT ERROR] Search failed: ${err.message}`);
            throw err;
        }
    }

    // Helper to get all snippets for aggregation (no vector search needed usually, just scroll)
    async getAllBookSnippets(bookId: string, userId: number) {
        try {
            // Scroll API is better for retrieval without query
            // Note: Qdrant scroll handles pagination. For now getting first 10k is likely enough for PoC.
            const points = await this.client.scroll(COLLECTION_NAME, {
                filter: {
                    must: [
                        { key: 'book_id', match: { value: bookId } },
                        { key: 'user_id', match: { value: userId } },
                        { key: 'layer', match: { value: 'SNIPPET' } }
                    ]
                },
                limit: 10000,
                with_payload: true
            });

            return points.points.map(p => ({
                id: p.id as string,
                text: p.payload?.text as string,
                entity_names: p.payload?.entity_names as string[],
                labels: p.payload?.labels as string[],
                position_index: p.payload?.position_index as number
            })).sort((a, b) => (a.position_index || 0) - (b.position_index || 0));

        } catch (e: any) {
            console.error("[QDRANT] Failed to fetch snippets:", e.message);
            return [];
        }
    }

    async checkHealth(): Promise<{ status: 'OK' | 'FAILED', message?: string }> {
        try {
            // 1. Connection Check
            const result = await this.client.getCollections();
            const exists = result.collections.some(c => c.name === COLLECTION_NAME);

            if (!exists) {
                return { status: 'FAILED', message: `Collection '${COLLECTION_NAME}' does not exist.` };
            }

            // 2. Simple count check
            const count = await this.client.count(COLLECTION_NAME);

            return { status: 'OK', message: `Fragments: ${count.count}` };

        } catch (err: any) {
            return { status: 'FAILED', message: `Qdrant Error: ${err.message}` };
        }
    }
}

export const vectorStore = new QdrantVectorStore();
