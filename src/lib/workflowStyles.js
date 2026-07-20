import { WORKFLOW_STAGES, BRON_TYPES } from '../data/constants'

// Categorische kleurcodering per workflowfase — bewust een andere kleurfamilie
// (koeler, gevarieerder van kleurtoon) dan de warme, ordinale risico-ernst-reeks
// in riskStyles.js, zodat de twee kleursystemen nooit door elkaar gelezen
// worden. Geen stoplichtkleuren (geen puur rood/groen/geel).
const STAGE_COLORS = {
  analyse_refinement: '#6b7f8f',
  ontwikkeling_configuratie: '#4f7a72',
  testen: '#2a5f8a',
  acceptatie: '#5c6b8a',
  hardening: '#7a5c8a',
  release_overdracht: '#8a6f4f',
  beheer_nazorg: '#6f6a5c',
}

export function stageColor(stage) {
  return STAGE_COLORS[stage] ?? '#64748b'
}

export function stageIndex(stage) {
  return WORKFLOW_STAGES.indexOf(stage)
}

// Vaste kleur per brontype ("van wie/wat komt dit input-item") — zelfde
// principe als STAGE_COLORS/riskStyles: één canonieke, uitlegbare kleur per
// waarde, geen vrije kleurkeuze. Dit is de kleurcodering waarnaar de
// Miro-achtige canvasannotaties (stickies/vormen) ook teruggrijpen, zodat
// handmatige aantekeningen dezelfde beeldtaal spreken als de automatisch
// gekleurde input-items.
const BRON_TYPE_COLORS = {
  team: '#5c7a8a',
  rol: '#2d4a6b',
  persoon: '#7a5c8a',
  systeem: '#4f7a72',
  omgeving: '#8a6f4f',
  stakeholder: '#c77a94',
}

export function bronTypeColor(bronType) {
  return BRON_TYPE_COLORS[bronType] ?? null
}

// Palet voor vrije canvasannotaties (stickies, vormen, lijnen): dezelfde zes
// brontype-kleuren plus een neutrale optie, zodat een gebruiker bewust kan
// kiezen "deze notitie hoort bij dezelfde bron als roze input-items".
export const ANNOTATION_PALETTE = [
  { value: '#c9beac', bronType: null },
  ...BRON_TYPES.map((bronType) => ({ value: BRON_TYPE_COLORS[bronType], bronType })),
]
