// FILE: shared/src/analysisTypes.ts
import { z } from 'zod';

export const TimeStateEnum = z.enum(['BEFORE', 'AFTER', 'CONSTANT', 'UNKNOWN']);
export type TimeState = z.infer<typeof TimeStateEnum>;

export const EvidenceSchema = z.object({
    quote: z.string(),
    sourceId: z.string().optional(),
    page: z.number().optional(),
    chunkId: z.string().optional(),
    locationHint: z.string().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// Helper for generic attribute value schema
export const createAttributeValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) => z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    timeState: TimeStateEnum,
    evidence: z.array(EvidenceSchema),
    notes: z.string().optional()
});

// Generic Interface
export interface AttributeValue<T> {
    value: T | null;
    confidence: number;
    timeState: TimeState;
    evidence: Evidence[];
    notes?: string;
}

// Default string-based attribute value
export const StringAttributeValueSchema = createAttributeValueSchema(z.string().or(z.array(z.string())));
export type StringAttributeValue = z.infer<typeof StringAttributeValueSchema>;

// Detailed Analysis Result Map
export const AnalysisResultSchema = z.record(z.string(), StringAttributeValueSchema);
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ---------------------------------------------------------------------------
// LEGACY TYPES (Character Pipeline)
// ---------------------------------------------------------------------------
export type VisualSourceType = 'explicit' | 'inferred_from_text' | 'unknown';

export interface VisualEvidenceLegacy {
    fragmentIndex?: number;
    quote: string;
    bookTitle?: string;
    globalSceneIndex?: number;
}

export interface VisualAttribute {
    value: string;
    sourceType: VisualSourceType;
    evidence: VisualEvidenceLegacy[];
}

// export type TimeStateAttribute = AttributeValue<string>; // REMOVED as per refactor


// Generic Visual Analysis Result
export interface VisualAnalysisResult<TAttributes = VisualAttribute> {
    title: string;
    name: string;
    description: string;
    attributes: Record<string, TAttributes>;
    contextSources: Array<{ source: string; summary: string }>;
}
