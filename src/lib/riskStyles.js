// Warme, ingetogen severity-ramp binnen één huisfamilie (dieptan → terracotta →
// verbrande oker → dieppaars-bordeaux). Ordinaal: leesbaar als oplopende
// ernst, niet als vier losse categorieën. Gevalideerd met de dataviz-skill
// validator (ordinal mode): monotone lightness, hue spread 19°, alle checks PASS.
//
// `hex` is gekalibreerd voor gebruik op lichte oppervlakken (badges/dots/edges).
// `onDark` is een opgelichte variant van dezelfde tint, voor tekst op de
// donkere hover-tooltip — de basis `hex` van Kritiek/Hoog is zelf te donker
// om als tekstkleur op een donkere achtergrond te lezen.
export const RISK_STYLES = {
  Laag: {
    badge: 'bg-[#b8a08e]/[0.16] text-[#6b5645] border border-[#b8a08e]/40',
    dot: 'bg-[#b8a08e]',
    hex: '#b8a08e',
    onDark: '#ddccc0',
  },
  Gemiddeld: {
    badge: 'bg-[#c17d54]/[0.16] text-[#8a4620] border border-[#c17d54]/40',
    dot: 'bg-[#c17d54]',
    hex: '#c17d54',
    onDark: '#e3a67c',
  },
  Hoog: {
    badge: 'bg-[#a8502c]/[0.16] text-[#7a3315] border border-[#a8502c]/40',
    dot: 'bg-[#a8502c]',
    hex: '#a8502c',
    onDark: '#e0946a',
  },
  Kritiek: {
    badge: 'bg-[#6e2a1e]/[0.16] text-[#5c2015] border border-[#6e2a1e]/45',
    dot: 'bg-[#6e2a1e]',
    hex: '#6e2a1e',
    onDark: '#e29a89',
  },
}

export function riskStyle(level) {
  return RISK_STYLES[level] ?? RISK_STYLES.Laag
}
