import { WORKFLOW_STAGES, BRON_TYPES } from '../data/constants'

// Categorische kleurcodering per workflowfase — bewust een andere kleurfamilie
// (blauw/paars/roze spectrum) dan de warme, ordinale risico-ernst-reeks in
// riskStyles.js (muted groen/amber/oranje/bordeaux), zodat de twee
// kleursystemen nooit door elkaar gelezen worden. Vol verzadigd (niet
// gedimd) zodat de 7 fases ook in de dunne kleurstrook op de stage-kaart
// duidelijk van elkaar te onderscheiden zijn; de reeks loopt bewust van
// cyaan naar roze zodat volgorde ook een beetje "leesbaar" is.
const STAGE_COLORS = {
  analyse_refinement: '#06b6d4',
  ontwikkeling_configuratie: '#2563eb',
  testen: '#4f46e5',
  acceptatie: '#7c3aed',
  hardening: '#a855f7',
  release_overdracht: '#c026d3',
  beheer_nazorg: '#db2777',
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
  team: '#0ea5e9',
  rol: '#4338ca',
  persoon: '#9333ea',
  systeem: '#0d9488',
  omgeving: '#d97706',
  stakeholder: '#e11d48',
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
