export * from './index';
import { z } from 'zod';

export const ImageFormatEnum = z.enum([
    // Legacy / Existing
    'INFOGRAPHIC',
    'ANNOTATED_DIAGRAM',
    'BLUEPRINT',
    'EXPLODED_VIEW',
    'ORTHOGRAPHIC_VIEWS',
    'CUTAWAY',
    'COLLECTOR_PLATE',
    'FIELD_GUIDE_ENTRY',
    'WEAPON_CARD',
    'MUSEUM_PLACARD',
    'SCHEMATIC',
    'ARMORY_INVENTORY_PLATE',
    'FIELD_MANUAL_PAGE',
    'SILHOUETTE_COMPARISON',
    // New
    'TSHIRT_GRAPHIC',
    'POSTER_INFOGRAPHIC',
    'TECHNICAL_BLUEPRINT',
    'PATENT_LINE_ART',
    'CUTAWAY_DIAGRAM',
    'ORTHOGRAPHIC_TURNAROUND',
    'TRADING_CARD',
    'STICKER',
    'LOGO_BADGE',
    'BOOK_COVER_CONCEPT',
    'SCIENCE_DIAGRAM',
    'ABSTRACT_VISUALIZATION'
]);

export type ImageFormat = z.infer<typeof ImageFormatEnum>;

export const ArtStyleEnum = z.enum([
    // Legacy / Existing
    'ANIME_LINEWORK',
    'DA_VINCI_SKETCH',
    'PATENT_DRAWING',
    'ENGRAVING',
    'MINIMAL_VECTOR',
    'FANTASY_OIL',
    'CYANOTYPE_BLUEPRINT',
    'MANGA_TECHNICAL',
    'WATERCOLOR_ILLUSTRATION',
    'DIGITAL_PAINTING',
    'MATTE_PAINTING',
    'RPG_ITEM_CARD',
    // New
    'ANIME',
    'MANGA_INK',
    'LEONARDO_DA_VINCI',
    'SYNTHWAVE',
    'PIXEL_ART',
    'OIL_PAINTING',
    'WATERCOLOR',
    'COMIC_BOOK',
    'VINTAGE_AD',
    'BLUEPRINT_INK'
]);

export type ArtStyle = z.infer<typeof ArtStyleEnum>;

export const OutputUseEnum = z.enum([
    'TSHIRT',
    'POSTER',
    'STICKER',
    'COLLECTOR_PRINT',
    'BOOK_ILLUSTRATION',
    'INFOGRAPHIC_PANEL'
]);

export type OutputUse = z.infer<typeof OutputUseEnum>;

export interface GenerationConfigOptions {
    formats: string[];
    styles: string[];
    uses: string[];
}


