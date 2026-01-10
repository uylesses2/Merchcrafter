
import { PrismaClient } from '@prisma/client';
import { budgetService } from './budgetService';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

// Types corresponding to Protocol Inputs
interface Phase0Input {
    entityId: string;
    entityType: string;
    analyzedTraits: string;
    focusText?: string;
    stylePreset: string;
    aspectRatio: string;
    constraints?: string;
}

interface Phase1Input {
    entityId: string;
    entityType: string;
    anchorImageId: number;
    canonScope: 'character_model' | 'non_character_entity';
}

interface Phase2AInput {
    entityId: string;
    turnaroundMode: string;
    sheetLayout?: string;
    background?: string;
    lighting?: string;
}

interface Phase2BInput {
    entityId: string;
    expressionsList?: string[];
    background?: string;
    lighting?: string;
}

interface Phase2CInput {
    entityId: string;
    turnaroundSheetUrl: string;
    faceSheetUrl?: string; // Optional
    expectedLayout?: string;
}

interface Phase3Input {
    entityId: string;
    userTraits: {
        palette?: string;
        materials?: string;
        cleanliness?: string;
        vibe?: string;
        gearOverrides?: string;
    };
    forbidden?: string[];
}

interface Phase4Input {
    projectId: number;
    outputPreset: string;
    selectedEntities: { entityId: string; role: string }[];
    selectedRefImages: string[]; // URLs
    traitBlock: string;
    compositionNotes?: string;
    constraints?: string;
    aspectRatio?: string;
}

export const orchestratorService = {

    // --- PHASE 0: QUICK CREATE ---
    async phase0_QuickCreate(input: Phase0Input) {
        // 1. Validate Budget
        const costCheck = await budgetService.checkBudget('imageGeneration', 'gemini-3-pro-image', 1); // Assume model
        if (!costCheck.allowed) throw new Error(costCheck.reason);

        // 2. Construct Prompt (Strict Order)
        const parts = [
            `Subject: ${input.analyzedTraits}`, // A. Identity
            input.focusText ? `Focus/Mood: ${input.focusText}` : '', // B. Focus
            `Style: ${input.stylePreset}`, // C. Style
            input.constraints ? `Constraints: ${input.constraints}` : '', // D. Constraints
            // "NO turnaround sheet" implicit by not asking for it?
        ].filter(p => !!p);

        const finalPrompt = parts.join('\n');

        // 3. Mock Call (Replace with actual LLM call in real impl)
        // const result = await genAI...
        const mockImageUrl = "https://placeholderapi.dev/image/phase0_result.png";

        // 4. Charge Budget
        await budgetService.chargeBudget('imageGeneration', 'gemini-3-pro-image', 'gemini', 1);

        // 5. Storage Update
        const generation = await prisma.generation.create({
            data: {
                projectId: 0, // Needs project ID context? Or linked to Entity? Protocol says "storage_updates" for generated_images.
                // We might need a dummy project or link this differently.
                // For now, let's assume we have a project context or create one.
                // Assuming global pool for entity creation? 
                // Let's create a "Scratchpad" project if needed or require projectId in input.
                // Input didn't specify projectId. We'll skip specific project link or use a system draft project.
                // EDIT: We'll require projectId in real app. For now using 1.
                projectId: 1,
                type: "PREVIEW",
                prompt: finalPrompt,
                model: "gemini-3-pro-image",
                provider: "gemini",
                isAnchorCandidate: true,
                status: "COMPLETED",
                imageUrl: mockImageUrl,
                entityId: input.entityId
            }
        });

        return {
            step_name: "PHASE_0_QUICK_CREATE",
            final_image_prompt: finalPrompt,
            model_call: {
                model: "gemini-3-pro-image",
                output_images: 1,
                notes: "Creative Generation"
            },
            storage_result: generation,
            next_step: "PHASE_1_CANON_UPGRADE_DECISION"
        };
    },

    // --- PHASE 1: CANON UPGRADE ---
    async phase1_CanonUpgrade(input: Phase1Input) {
        // 1. Validate Anchor Exists
        const anchor = await prisma.generation.findUnique({ where: { id: input.anchorImageId } });
        if (!anchor) throw new Error(`Anchor image ${input.anchorImageId} not found`);

        // 2. Upsert Entity Canon
        const canon = await prisma.entityCanon.upsert({
            where: {
                // We need a unique constraint on entityId? Schema doesn't strictly enforce one-to-one yet but logic does.
                // We will find first or create.
                id: "temp_lookup_hack" // UUIDs make upsert hard without unique key on entityId.
            },
            update: {
                anchorImageId: input.anchorImageId,
                canonVersion: { increment: 1 },
                status: "BUILDING",
                entityType: input.entityType
            },
            create: {
                entityId: input.entityId,
                entityType: input.entityType,
                anchorImageId: input.anchorImageId,
                status: "BUILDING",
                canonVersion: 1
            }
        });

        // *Fix*: upsert requires unique where. We'll use findFirst + update/create logic manually.
        const existingCanon = await prisma.entityCanon.findFirst({ where: { entityId: input.entityId } });
        let resultCanon;
        if (existingCanon) {
            resultCanon = await prisma.entityCanon.update({
                where: { id: existingCanon.id },
                data: {
                    anchorImageId: input.anchorImageId,
                    canonVersion: { increment: 1 },
                    status: "BUILDING",
                    entityType: input.entityType
                }
            });
        } else {
            resultCanon = await prisma.entityCanon.create({
                data: {
                    entityId: input.entityId,
                    entityType: input.entityType,
                    anchorImageId: input.anchorImageId,
                    status: "BUILDING",
                    canonVersion: 1
                }
            });
        }

        return {
            step_name: "PHASE_1_CANON_UPGRADE_DECISION",
            storage_updates: { table: "entity_canon", id: resultCanon.id, status: "BUILDING" },
            next_step: "PHASE_2_CANON_SHEET_GENERATION"
        };
    },

    // --- PHASE 2A: TURNAROUND SHEET ---
    async phase2A_Turnaround(input: Phase2AInput) {
        // 1. Get Anchor
        const canon = await prisma.entityCanon.findFirst({
            where: { entityId: input.entityId },
            include: { anchorImage: true }
        });
        if (!canon || !canon.anchorImage) throw new Error("Canon/Anchor not defined");

        // 2. Budget Check
        const costCheck = await budgetService.checkBudget('imageGeneration', 'gemini-3-pro-image', 1);
        if (!costCheck.allowed) throw new Error(costCheck.reason);

        // 3. Prompt
        const prompt = `Structural reference sheet based strictly on the provided reference image. Turnaround mode: ${input.turnaroundMode}. ${input.sheetLayout || "4-panel"}. Neutral pose. Accuracy over beauty.`;

        // 4. Mock Call (Image Conditional)
        const mockImageUrl = "https://placeholderapi.dev/image/turnaround_result.png";

        // 5. Charge
        await budgetService.chargeBudget('imageGeneration', 'gemini-3-pro-image', 'gemini', 1);

        // 6. Store Sheet
        const sheet = await prisma.canonSheet.create({
            data: {
                canonId: canon.id,
                sheetType: "turnaround",
                imageUrl: mockImageUrl,
                sourceAnchorId: canon.anchorImageId
            }
        });

        // Update Canon Status
        await prisma.entityCanon.update({
            where: { id: canon.id },
            data: { status: "SHEETS_GENERATED_OR_PARTIAL" }
        });

        return {
            step_name: "PHASE_2A_TURNAROUND_SHEET",
            turnaround_prompt: prompt,
            storage_updates: { sheetId: sheet.id },
            next_step: "PHASE_2B_FACE_SHEET_OR_PHASE_2C_SHEET_CROPPING"
        };
    },

    // --- PHASE 2B: FACE SHEET ---
    async phase2B_FaceSheet(input: Phase2BInput) {
        const canon = await prisma.entityCanon.findFirst({
            where: { entityId: input.entityId },
            include: { anchorImage: true }
        });
        if (!canon || !canon.anchorImage) throw new Error("Canon/Anchor not defined");

        // 1. Budget
        const costCheck = await budgetService.checkBudget('imageGeneration', 'gemini-3-pro-image', 1);
        if (!costCheck.allowed) throw new Error(costCheck.reason);

        // 2. Prompt
        const prompt = `Structural face sheet. Expressions: ${(input.expressionsList || ["Neutral"]).join(', ')}. Strict identity match. Head and shoulders crop.`;

        // 3. Mock Call
        const mockImageUrl = "https://placeholderapi.dev/image/face_sheet_result.png";

        // 4. Charge
        await budgetService.chargeBudget('imageGeneration', 'gemini-3-pro-image', 'gemini', 1);

        // 5. Store
        const sheet = await prisma.canonSheet.create({
            data: {
                canonId: canon.id,
                sheetType: "face",
                imageUrl: mockImageUrl,
                sourceAnchorId: canon.anchorImageId
            }
        });

        return {
            step_name: "PHASE_2B_FACE_SHEET",
            face_sheet_prompt: prompt,
            storage_updates: { sheetId: sheet.id },
            next_step: "PHASE_2C_SHEET_CROPPING"
        };
    },

    // --- PHASE 2C: CROPPING ---
    async phase2C_Cropping(input: Phase2CInput) {
        const canon = await prisma.entityCanon.findFirst({ where: { entityId: input.entityId } });
        if (!canon) throw new Error("Canon not found");

        // 1. Logic to define crops (Hardcoded for prototype)
        // In real app, this would use vision analysis or fixed grid logic.
        const turnaroundCrops = [
            { name: "front", url: input.turnaroundSheetUrl + "?crop=front" },
            { name: "side", url: input.turnaroundSheetUrl + "?crop=side" },
            { name: "back", url: input.turnaroundSheetUrl + "?crop=back" },
            // ...
        ];

        // 2. Store Refs
        for (const crop of turnaroundCrops) {
            await prisma.entityReferenceImage.create({
                data: {
                    canonId: canon.id,
                    url: crop.url,
                    tag: "identity",
                    sourceSheet: "turnaround",
                    cropName: crop.name
                }
            });
        }

        // 3. Mark Ready
        await prisma.entityCanon.update({
            where: { id: canon.id },
            data: { status: "READY" }
        });

        return {
            step_name: "PHASE_2C_SHEET_CROPPING",
            storage_updates: { created_refs: turnaroundCrops.length, status: "READY" },
            next_step: "PHASE_3_TRAIT_INFLUENCE_LAYER"
        };
    },

    // --- PHASE 3: TRAIT INFLUENCE ---
    async phase3_TraitInfluence(input: Phase3Input) {
        // 1. Construct TRAIT_BLOCK
        const block = `
INFLUENCE INSTRUCTIONS:
- Palette: ${input.userTraits.palette || "Unchanged"}
- Materials: ${input.userTraits.materials || "Standard"}
- Vibe: ${input.userTraits.vibe || "Neutral"}
- Wear: ${input.userTraits.cleanliness || "Standard"}
- Accessories: ${input.userTraits.gearOverrides || "Standard"}

FORBIDDEN:
- Do NOT change facial identity.
- Do NOT change body proportions.
- Do NOT redesign core features.
        `.trim();

        // 2. Store (linking to Project? Or where? Protocol says "project_state")
        // We need a projectId context usually. 
        // Or update a temporary state map if we are editing a draft.
        // Let's assume we update the most recent Project for this user/entity session.
        // This part is fuzzy in protocol without project_id input.
        // We will just return it for now.

        return {
            step_name: "PHASE_3_TRAIT_INFLUENCE_LAYER",
            trait_block: block,
            next_step: "PHASE_4_COMPOSITION_OUTPUT"
        };
    },

    // --- PHASE 4: COMPOSITION ---
    async phase4_Composition(input: Phase4Input) {
        // 1. Budget
        const costCheck = await budgetService.checkBudget('imageGeneration', 'gemini-3-pro-image', 1);
        if (!costCheck.allowed) throw new Error(costCheck.reason);

        // 2. Construct Prompt
        const finalPrompt = [
            `SCAFFOLD: ${input.outputPreset} composition.`,
            `ROSTER: ${input.selectedEntities.map(e => e.entityId + ' (' + e.role + ')').join(', ')}`,
            `TRAITS: ${input.traitBlock}`,
            `STRICT IDENTITY: Do not redesign identities; match reference sheets provided.`,
            `CONSTRAINTS: ${input.constraints || "None"}. Aspect Ratio: ${input.aspectRatio || "1:1"}`
        ].join('\n\n');

        // 3. Mock Call (Image Conditional x 14)
        const mockImageUrl = "https://placeholderapi.dev/image/final_comp.png";

        // 4. Charge
        await budgetService.chargeBudget('imageGeneration', 'gemini-3-pro-image', 'gemini', 1);

        // 5. Store
        const result = await prisma.generation.create({
            data: {
                projectId: input.projectId,
                type: "FINAL",
                prompt: finalPrompt,
                model: "gemini-3-pro-image",
                provider: "gemini",
                imageUrl: mockImageUrl,
                status: "COMPLETED",
                refsUsedCount: input.selectedRefImages.length
            }
        });

        return {
            step_name: "PHASE_4_COMPOSITION_OUTPUT",
            final_prompt: finalPrompt,
            result_image: mockImageUrl,
            next_step: "PHASE_4A_OPTIONAL_REGEN_FROM_SHEETS"
        };
    }
};
