
import { z } from 'zod';
import { ImageFormatEnum, ArtStyleEnum, OutputUseEnum } from './imageTypes';

// Re-export for convenience if needed, but primarily used here
export const CreativePresetSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    compatibleEntityTypes: z.array(z.string()), // ['*'] for all
    recommended: z.object({
        format: ImageFormatEnum,
        style: ArtStyleEnum,
        use: OutputUseEnum
    }),
    requiredAttributes: z.array(z.string()).optional(),
    constraints: z.object({
        maxColors: z.number().optional(),
        maxTextBlocks: z.number().optional(),
        avoidFineText: z.boolean().optional(),
        highContrast: z.boolean().optional(),
        silhouettePriority: z.boolean().optional(),
        printableLineWeightMinPt: z.number().optional()
    }).optional(),
    tags: z.array(z.string()).optional()
});

export type CreativePreset = z.infer<typeof CreativePresetSchema>;

export const CREATIVE_PRESETS: CreativePreset[] = [
    {
        id: 'tshirt-weapon-infographic',
        name: 'T-Shirt Weapon Infographic',
        description: 'Minimalist vector breakdown of a weapon, suitable for screen printing.',
        compatibleEntityTypes: ['ITEM_OR_ARTIFACT'],
        recommended: {
            format: 'INFOGRAPHIC',
            style: 'MINIMAL_VECTOR',
            use: 'TSHIRT'
        },
        requiredAttributes: ['weaponCharacteristics.edgeType', 'weaponCharacteristics.hiltConstruction'],
        constraints: {
            maxColors: 4,
            avoidFineText: true,
            highContrast: true,
            printableLineWeightMinPt: 1.5
        },
        tags: ['apparel', 'minimal', 'weapon']
    },
    {
        id: 'leonardo-technical-plate',
        name: 'Leonardo-Style Technical Plate',
        description: 'Sepia-toned, hand-sketched diagram with annotated callouts.',
        compatibleEntityTypes: ['*'],
        recommended: {
            format: 'ANNOTATED_DIAGRAM',
            style: 'DA_VINCI_SKETCH',
            use: 'POSTER'
        },
        constraints: {
            maxTextBlocks: 5,
            avoidFineText: false
        },
        tags: ['vintage', 'artistic', 'detailed']
    },
    {
        id: 'anime-infographic-hybrid',
        name: 'Anime Infographic Hybrid',
        description: 'High-energy character or item showcase with stats and dynamic composition.',
        compatibleEntityTypes: ['CHARACTER', 'MONSTER_OR_CREATURE', 'ITEM_OR_ARTIFACT'],
        recommended: {
            format: 'INFOGRAPHIC',
            style: 'ANIME_LINEWORK',
            use: 'POSTER' // or TSHIRT
        },
        constraints: {
            highContrast: true
        },
        tags: ['modern', 'anime', 'vibrant']
    },
    {
        id: 'blueprint-collector-print',
        name: 'Blueprint Collector Print',
        description: 'Classic cyanotype blueprint with white lines on blue, precise technical feel.',
        compatibleEntityTypes: ['LOCATION_OR_BUILDING', 'ITEM_OR_ARTIFACT', 'SPACE_SHIP', 'SPACE_STATION'],
        recommended: {
            format: 'BLUEPRINT',
            style: 'CYANOTYPE_BLUEPRINT',
            use: 'POSTER'
        },
        constraints: {
            maxColors: 2,
            avoidFineText: false
        },
        tags: ['technical', 'blue', 'architecture']
    },
    {
        id: 'patent-drawing-cutaway',
        name: 'Patent Drawing Cutaway',
        description: 'Black and white patent-style illustration showing internal mechanisms.',
        compatibleEntityTypes: ['ITEM_OR_ARTIFACT', 'SPACE_SHIP', 'VEHICLE'],
        recommended: {
            format: 'CUTAWAY',
            style: 'PATENT_DRAWING',
            use: 'COLLECTOR_PRINT'
        },
        requiredAttributes: ['internalStructure', 'mechanisms'],
        constraints: {
            maxColors: 1,
            avoidFineText: false,
            printableLineWeightMinPt: 0.5
        },
        tags: ['technical', 'retro', 'detailed']
    },
    {
        id: 'fantasy-field-guide',
        name: 'Fantasy Field Guide Entry',
        description: 'Watercolor page from a naturalist\'s journal, organic and textured.',
        compatibleEntityTypes: ['MONSTER_OR_CREATURE', 'PLANT', 'ALIEN'],
        recommended: {
            format: 'FIELD_GUIDE_ENTRY',
            style: 'WATERCOLOR_ILLUSTRATION',
            use: 'BOOK_ILLUSTRATION'
        },
        tags: ['organic', 'fantasy', 'soft']
    },
    {
        id: 'rpg-item-card-glossy',
        name: 'RPG Item Card (Glossy)',
        description: 'Digitally painted icon suitable for game cards or high-res detailed icons.',
        compatibleEntityTypes: ['ITEM_OR_ARTIFACT'],
        recommended: {
            format: 'WEAPON_CARD',
            style: 'RPG_ITEM_CARD',
            use: 'COLLECTOR_PRINT'
        },
        tags: ['game', 'digital', 'item']
    },
    {
        id: 'scifi-spec-sheet',
        name: 'Sci-Fi Spec Sheet',
        description: 'Futuristic, clean layout with ortho views and data blocks.',
        compatibleEntityTypes: ['SPACE_SHIP', 'SPACE_STATION', 'VEHICLE', 'ROBOT'],
        recommended: {
            format: 'ORTHOGRAPHIC_VIEWS',
            style: 'MANGA_TECHNICAL', // Close enough to tech-lined styles
            use: 'POSTER'
        },
        constraints: {
            highContrast: false // Can be subtle
        },
        tags: ['scifi', 'technical', 'clean']
    }
];
