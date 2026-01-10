
import { VisualAttribute } from './index';

export type EntityType =
    | 'CHARACTER'
    | 'MONSTER_OR_CREATURE'
    | 'ITEM_OR_ARTIFACT'
    | 'LOCATION'
    | 'SCENE_OR_EVENT'
    | 'GROUP_OR_FACTION_OR_ORGANIZATION'
    | 'LANDMARK_OR_STRUCTURE'
    | 'BATTLE_OR_DUEL_OR_CONFLICT'
    | 'SPELL_OR_POWER_OR_ABILITY'
    | 'VEHICLE_OR_MOUNT'
    | 'PROPHECY_OR_LEGEND_OR_MYTH'
    | 'ALIEN'
    | 'ENTITY'
    | 'PLANET'
    | 'STAR_SYSTEM'
    | 'SPACE_SHIP'
    | 'SPACE_STATION'
    | 'SPACE_ANOMALY';

export interface AnalysisTemplate {
    entityType: EntityType;
    attributes: string[];
    // Extended metadata for typed/time-aware attributes (optional)
    attributeMeta?: Record<string, { valueType: 'string' | 'stringArray' | 'number' | 'boolean' | 'json' }>;
    // Helper to generate search queries for a specific field
    buildQueries?: (entityName: string, field: string) => string[];
}

// 1. CHARACTER (Legacy/Existing)
// We define this to match the existing hardcoded list in visualAnalyzer.ts exactly, 
// but the backend will likely route to the legacy function for safety.
export const CHARACTER_TEMPLATE: AnalysisTemplate = {
    entityType: 'CHARACTER',
    attributes: [
        'hairColor', 'hairStyleOrLength', 'eyeColor', 'baselineSkinTone',
        'heightOrStature', 'buildOrBodyType', 'ageAppearance',
        'raceOrSpeciesOrHeritage', 'notableFacialFeatures', 'scarsAndTattoos',
        'clothingStyleOrOutfit',
        'armorType', 'shieldOrActiveDefense', 'helmOrHeadgear',
        'primaryWeapon', 'secondaryWeapon', 'rangedWeapon',
        'carriedEquipment', 'accessories',
        'activeInjuriesOrWounds', 'physicalCondition', 'bloodOrGrim',
        'generalVibe', 'emotionalState'
    ],
    // Legacy logic handles queries internally
};

// 2. ITEM OR ARTIFACT
export const ITEM_TEMPLATE: AnalysisTemplate = {
    entityType: 'ITEM_OR_ARTIFACT',
    attributes: [
        'itemType', 'sizeOrScale', 'materials', 'primaryColorPalette',
        'shapeAndGeometry', 'markingsOrInscriptions', 'craftsmanshipOrStyleEra',
        'conditionOrWear', 'notableFeatures', 'howItIsCarriedOrStored',
        'originOrMaker', 'auraOrEffects', 'vibeOrImpression',
        // Artifact Micro-Details
        'activationMethod', 'gemSettings', 'emittedEffects', 'corruptionOrTaint',
        'concealability', 'bindingOrOwnership',
        // Weapon Characteristics (Blades & Firearms)
        'weaponEdgeType', 'weaponBladeProfile', 'weaponCrossSection',
        'weaponPointStyle', 'weaponFullerPresence', 'weaponGuardType',
        'weaponHiltConstruction', 'weaponBalance', 'weaponPommel',
        'weaponGripWrap', 'weaponScabbardMaterials', 'weaponMakerMark',
        'firearmBarrelCount', 'firearmActionType', 'firearmCaliber',
        'firearmMagazineType', 'firearmOptics', 'firearmSuppressor',
        'firearmStockType', 'firearmFeedMechanism'
    ],
    buildQueries: (name, field) => {
        if (field.startsWith('weapon')) {
            const cleanField = field.replace('weapon', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
            return [
                `${name} ${cleanField}`,
                `${name} blade details`,
                `${name} single-edged`,
                `${name} double-edged`,
                `${name} one-edged`,
                `${name} two-edged`,
                `${name} sharpened on one side`,
                `${name} sharpened on both sides`,
                `${name} hilt guard pommel`
            ];
        }
        if (field.startsWith('firearm')) {
            const cleanField = field.replace('firearm', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
            return [
                `${name} ${cleanField}`,
                `${name} gun specifications`,
                `${name} barrel count`,
                `${name} one barrel`,
                `${name} two barrels`,
                `${name} double-barrel`,
                `${name} six-shooter`,
                `${name} action type`
            ];
        }
        if (field === 'markingsOrInscriptions' || field === 'weaponMakerMark') {
            return [`${name} inscription`, `${name} maker mark`, `${name} runes`, `${name} text`];
        }
        return [`${name} ${field}`, `${name} appearance`, `${name} description`];
    }
};

export const WEAPON_ATTRIBUTES = [
    'weaponEdgeType', 'weaponBladeProfile', 'weaponCrossSection',
    'weaponPointStyle', 'weaponFullerPresence', 'weaponGuardType',
    'weaponHiltConstruction', 'weaponBalance', 'weaponPommel',
    'weaponGripWrap', 'weaponScabbardMaterials', 'weaponMakerMark',
    'firearmBarrelCount', 'firearmActionType', 'firearmCaliber',
    'firearmMagazineType', 'firearmOptics', 'firearmSuppressor',
    'firearmStockType', 'firearmFeedMechanism'
];

export function isWeaponLike(entityName: string, itemType: string | undefined): boolean {
    const keywords = [
        'dagger', 'sword', 'blade', 'spear', 'bow', 'gun', 'rifle', 'pistol',
        'axe', 'hammer', 'mace', 'club', 'staff', 'wand', 'knife', 'saber',
        'rapier', 'claymore', 'halberd', 'lance', 'scythe', 'shuriken', 'dart',
        'arrow', 'bolt', 'quiver', 'shield', 'armor', 'helmet', 'gauntlet' // Broadly "combat gear" often has these traits
    ];
    const text = (entityName + ' ' + (itemType || '')).toLowerCase();
    return keywords.some(k => text.includes(k));
}

// 3. MONSTER OR CREATURE
export const MONSTER_TEMPLATE: AnalysisTemplate = {
    entityType: 'MONSTER_OR_CREATURE',
    attributes: [
        'speciesType', 'sizeOrScale', 'bodyPlanOrAnatomy', 'skinFurScales',
        'coloration', 'eyes', 'distinctiveFeatures', 'movementStyle',
        'soundsOrSmell', 'woundsOrScars', 'naturalWeapons', 'habitat',
        'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} biology`, `${name} appearance`]
};

// 4. LOCATION
export const LOCATION_TEMPLATE: AnalysisTemplate = {
    entityType: 'LOCATION',
    attributes: [
        'environmentBiome', 'climateWeatherFeel', 'lighting', 'terrain',
        'architectureOrStructures', 'layoutOrLandmarks', 'smellsOrSounds',
        'hazards', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} visual`, `${name} environment`]
};

// 5. SCENE OR EVENT
export const SCENE_TEMPLATE: AnalysisTemplate = {
    entityType: 'SCENE_OR_EVENT',
    attributes: [
        'setting', 'timeOfDayOrSeason', 'lighting', 'weather',
        'keyVisualElements', 'focalAction', 'crowdOrParticipants',
        'aftermathOrTraces', 'mood', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} description`, `${name} scene`]
};

// 6. GROUP
export const GROUP_TEMPLATE: AnalysisTemplate = {
    entityType: 'GROUP_OR_FACTION_OR_ORGANIZATION',
    attributes: [
        'symbolOrSigil', 'colorsOrLivery', 'uniformOrDress', 'rankMarkers',
        'typicalGear', 'baseOrTerritoryStyle', 'reputationVibe'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} uniform`, `${name} symbol`]
};

// 7. LANDMARK
export const LANDMARK_TEMPLATE: AnalysisTemplate = {
    entityType: 'LANDMARK_OR_STRUCTURE',
    attributes: [
        'structureType', 'materials', 'architectureStyle', 'sizeOrScale',
        'conditionOrWear', 'distinctiveFeatures', 'interiorFeel',
        'surroundings', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} architecture`, `${name} construction`]
};

// 8. BATTLE
export const BATTLE_TEMPLATE: AnalysisTemplate = {
    entityType: 'BATTLE_OR_DUEL_OR_CONFLICT',
    attributes: [
        'combatantsPresent', 'weaponsOrMagicSeen', 'terrainOrArena',
        'formationsOrPositions', 'notableMoments', 'damageOrDestruction',
        'injuriesOrCasualties', 'visibilityWeather', 'outcomeEvidence',
        'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} fight`, `${name} battle`]
};

// 9. SPELL
export const SPELL_TEMPLATE: AnalysisTemplate = {
    entityType: 'SPELL_OR_POWER_OR_ABILITY',
    attributes: [
        'visualEffectForm', 'colorLight', 'motionPattern', 'soundOrSmell',
        'radiusOrScale', 'castingTell', 'impactOnEnvironment', 'aftereffects',
        'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} visual`, `${name} effect`]
};

// 10. VEHICLE
export const VEHICLE_TEMPLATE: AnalysisTemplate = {
    entityType: 'VEHICLE_OR_MOUNT',
    attributes: [
        'vehicleOrMountType', 'sizeOrScale', 'materials', 'colorOrMarkings',
        'distinctiveFeatures', 'harnessOrTack', 'cargoOrLoadout',
        'conditionOrWear', 'movementStyle', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} appearance`, `${name} description`]
};

// 11. PROPHECY
export const PROPHECY_TEMPLATE: AnalysisTemplate = {
    entityType: 'PROPHECY_OR_LEGEND_OR_MYTH',
    attributes: [
        'mediumForm', 'imageryMotifs', 'symbolsOrIconography', 'toneOrMood',
        'associatedPeopleOrPlaces', 'recurringVisualElements', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [`${name} ${field}`, `${name} content`, `${name} text`]
};

// 12. ALIEN
export const ALIEN_TEMPLATE: AnalysisTemplate = {
    entityType: 'ALIEN',
    attributes: [
        'morphology', 'bodyPlan', 'appendages', 'locomotion',
        'sensoryOrgans', 'skinFurScalesOrSurface', 'coloration',
        'emissionOrGlow', 'sizeOrScale', 'communicationMode',
        'threatLevel', 'originOrRealm', 'abilitiesOrPowers', 'weaknesses',
        'artifactsOrToolsUsed', 'clothingOrWearables', 'auraOrPresence',
        'manifestationRules', 'habitat', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} biology`,
        `${name} appearance`,
        `${name} details`
    ]
};

// 13. ENTITY (Non-humanoid/Energy/Abstract)
export const ENTITY_TEMPLATE: AnalysisTemplate = {
    entityType: 'ENTITY',
    attributes: [
        'manifestationType', 'formOrSilhouette', 'sizeOrScale', 'opacityOrDensity',
        'colorLightOrGlow', 'textureOrParticles', 'motionBehavior',
        'sensoryOrgans', 'communicationMode', 'intelligenceLevel',
        'abilitiesOrPowers', 'environmentalInteraction', 'originOrAnchor',
        'auraOrPresence', 'soundOrPresenceEffects', 'weaknesses',
        'manifestationRules', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} form`,
        `${name} manifestation`,
        `${name} description`
    ]
};

// 14. PLANET
export const PLANET_TEMPLATE: AnalysisTemplate = {
    entityType: 'PLANET',
    attributes: [
        'planetType', 'radiusOrScale', 'gravity', 'atmosphere',
        'climateBands', 'weatherPatterns', 'terrainOrSurface',
        'hydrosphereOrLiquids', 'biosphereOrVegetation', 'dominantSpecies',
        'settlementsOrCivilization', 'techLevel', 'hazards',
        'orbitalPeriod', 'axialTilt', 'moons', 'rings',
        'notableLandmarks', 'illuminationOrSkyColor', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} geography`,
        `${name} environment`,
        `${name} atmosphere`,
        `surface of ${name}`
    ]
};

// 15. STAR SYSTEM
export const STAR_SYSTEM_TEMPLATE: AnalysisTemplate = {
    entityType: 'STAR_SYSTEM',
    attributes: [
        'starCount', 'starTypesAndColors', 'spectralClasses', 'habitableZone',
        'planetCount', 'systemLayout', 'asteroidBelts', 'nebulaPresence',
        'cosmicAnomalies', 'factionsPresent', 'navigationHazards',
        'jumpPointsOrGateways', 'spaceTraffic', 'overallColorPalette',
        'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} system`,
        `${name} stellar details`,
        `${name} astronomy`
    ]
};

// 16. SPACE SHIP
export const SPACE_SHIP_TEMPLATE: AnalysisTemplate = {
    entityType: 'SPACE_SHIP',
    attributes: [
        'shipClassOrRole', 'scaleOrDimensions', 'hullMaterialAndFinish',
        'propulsionSystem', 'powerSource', 'armament', 'defensesOrShields',
        'crewComplement', 'AIOrAutonomy', 'interiorStyle',
        'dockingInterfaces', 'sensorSuite', 'cargoCapacity',
        'insigniaOrMarkings', 'damageState', 'missionRole',
        'lightingAndEmissives', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} specifications`,
        `${name} hull`,
        `${name} interior`,
        `${name} capabilities`
    ]
};

// 17. SPACE STATION
export const SPACE_STATION_TEMPLATE: AnalysisTemplate = {
    entityType: 'SPACE_STATION',
    attributes: [
        'stationTypeOrPurpose', 'scaleOrDimensions', 'overallShape',
        'structuralMaterials', 'modulesAndSections', 'dockingBays',
        'powerSource', 'defensiveSystems', 'populationDemographics',
        'interiorLayout', 'gravityGeneration', 'visibleDamageOrDecay',
        'surroundingEnvironment', 'lightingAndSignage', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} station`,
        `${name} exterior`,
        `${name} structure`
    ]
};

// 18. SPACE ANOMALY
export const SPACE_ANOMALY_TEMPLATE: AnalysisTemplate = {
    entityType: 'SPACE_ANOMALY',
    attributes: [
        'anomalyType', 'sizeOrScale', 'stability', 'visualSignature',
        'colorLightAndGlow', 'shapeAndBoundary', 'effectsOnMatter',
        'effectsOnTime', 'radiationOrEnergyOutput', 'gravitationalEffects',
        'entryExitRules', 'visibility', 'detectionMethods',
        'navigationImpact', 'soundOrSensorReadings', 'originHypotheses',
        'containmentOptions', 'vibeOrImpression'
    ],
    buildQueries: (name, field) => [
        `${name} ${field}`,
        `${name} properties`,
        `${name} anomaly`,
        `${name} effects`
    ]
};

// REGISTRY
export const VISUAL_ANALYSIS_REGISTRY: Record<string, AnalysisTemplate> = {
    'CHARACTER': CHARACTER_TEMPLATE,
    'ITEM_OR_ARTIFACT': ITEM_TEMPLATE,
    'MONSTER_OR_CREATURE': MONSTER_TEMPLATE,
    'LOCATION': LOCATION_TEMPLATE,
    'SCENE_OR_EVENT': SCENE_TEMPLATE,
    'GROUP_OR_FACTION_OR_ORGANIZATION': GROUP_TEMPLATE,
    'LANDMARK_OR_STRUCTURE': LANDMARK_TEMPLATE,
    'BATTLE_OR_DUEL_OR_CONFLICT': BATTLE_TEMPLATE,
    'SPELL_OR_POWER_OR_ABILITY': SPELL_TEMPLATE,
    'VEHICLE_OR_MOUNT': VEHICLE_TEMPLATE,
    'PROPHECY_OR_LEGEND_OR_MYTH': PROPHECY_TEMPLATE,
    'ALIEN': ALIEN_TEMPLATE,
    'ENTITY': ENTITY_TEMPLATE,
    'PLANET': PLANET_TEMPLATE,
    'STAR_SYSTEM': STAR_SYSTEM_TEMPLATE,
    'SPACE_SHIP': SPACE_SHIP_TEMPLATE,
    'SPACE_STATION': SPACE_STATION_TEMPLATE,
    'SPACE_ANOMALY': SPACE_ANOMALY_TEMPLATE
};

export function getTemplate(type: string): AnalysisTemplate {
    return VISUAL_ANALYSIS_REGISTRY[type] || ENTITY_TEMPLATE;
}
