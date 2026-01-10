
import { ImageFormatEnum, ArtStyleEnum, OutputUseEnum } from './imageTypes';

export interface ValidationWarning {
    code: string;
    message: string;
    suggestion?: string;
}

export interface ValidationInput {
    format: string;
    style: string;
    use: string;
    constraints?: {
        maxTextBlocks?: number;
        avoidFineText?: boolean;
        highContrast?: boolean;
    };
}

export interface ValidationResult {
    ok: boolean;
    warnings: ValidationWarning[];
    errors: string[]; // Blocking errors
}

export function validateCreativeSelection(input: ValidationInput): ValidationResult {
    const { format, style, use, constraints } = input;
    const warnings: ValidationWarning[] = [];
    const errors: string[] = []; // Currently we don't block anything, just warn

    // RULE 1: TSHIRT Line Weight Risk
    if (use === 'TSHIRT') {
        if (['BLUEPRINT', 'PATENT_DRAWING'].includes(style)) {
            warnings.push({
                code: 'TSHIRT_FINE_LINES',
                message: 'Blueprints/Patent drawings often have lines too thin for screen printing.',
                suggestion: 'Consider MINIMAL_VECTOR or ANIME_LINEWORK for better printability.'
            });
        }
        if (format === 'ANNOTATED_DIAGRAM' || (constraints?.maxTextBlocks || 0) > 6) {
            warnings.push({
                code: 'TSHIRT_READABILITY',
                message: 'Too much small text may be unreadable on fabric.',
                suggestion: 'Reduce text blocks or switch to INFOGRAPHIC_PANEL.'
            });
        }
    }

    // RULE 2: Label Clarity in Painterly Styles
    if (format === 'INFOGRAPHIC' || format === 'ANNOTATED_DIAGRAM' || format === 'CUTAWAY') {
        if (['FANTASY_OIL', 'DIGITAL_PAINTING', 'MATTE_PAINTING', 'WATERCOLOR_ILLUSTRATION'].includes(style)) {
            if (!constraints?.highContrast) {
                warnings.push({
                    code: 'LABEL_CLARITY',
                    message: 'Painterly styles can make text labels hard to read.',
                    suggestion: 'Enable High Contrast or switch to a line-art style.'
                });
            }
        }
    }

    // RULE 3: Sticker Detail
    if (use === 'STICKER') {
        if (['BLUEPRINT', 'CUTAWAY', 'ORTHOGRAPHIC_VIEWS'].includes(format)) {
            warnings.push({
                code: 'STICKER_DETAIL',
                message: 'Complex technical formats often lose detail at sticker size.',
                suggestion: 'Consider WEAPON_CARD or CHARACTER_SHEET for specific focal points.'
            });
        }
    }

    // RULE 4: Da Vinci Sketch Text
    if (style === 'DA_VINCI_SKETCH' && format === 'INFOGRAPHIC') {
        warnings.push({
            code: 'SKETCH_LEGIBILITY',
            message: 'Mirror writing or sketch labels may be hard to parse as information.',
            suggestion: 'Ensure the prompt requests "readable labels" or use ANNOTATED_DIAGRAM.'
        });
    }

    return {
        ok: errors.length === 0,
        warnings,
        errors
    };
}
