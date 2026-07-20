// Rustige, functionele severity-ramp (grijsgroen → amber → warm rood/oranje →
// bordeaux). Ordinaal: leesbaar als oplopende ernst. Bewust gedempt/getemperd
// in plaats van felle stoplichtkleuren — kleur is nooit de enige drager
// (badges combineren altijd met het tekstlabel).
//
// `hex` is gekalibreerd voor gebruik op lichte oppervlakken (badges/dots/edges).
// `onDark` is een opgelichte variant van dezelfde tint, voor tekst op de
// donkere hover-tooltip — de basis `hex` van Kritiek/Hoog is zelf te donker
// om als tekstkleur op een donkere achtergrond te lezen.
export const RISK_STYLES = {
  Laag: {
    badge: 'bg-[#6b8f76]/[0.16] text-[#3f5943] border border-[#6b8f76]/40',
    dot: 'bg-[#6b8f76]',
    hex: '#6b8f76',
    onDark: '#a9c9b0',
  },
  Gemiddeld: {
    badge: 'bg-[#b8842c]/[0.16] text-[#7a5a1a] border border-[#b8842c]/40',
    dot: 'bg-[#b8842c]',
    hex: '#b8842c',
    onDark: '#e0b568',
  },
  Hoog: {
    badge: 'bg-[#c1552c]/[0.16] text-[#8a3b1c] border border-[#c1552c]/40',
    dot: 'bg-[#c1552c]',
    hex: '#c1552c',
    onDark: '#e8916a',
  },
  Kritiek: {
    badge: 'bg-[#7a2331]/[0.16] text-[#5c1620] border border-[#7a2331]/45',
    dot: 'bg-[#7a2331]',
    hex: '#7a2331',
    onDark: '#d98a92',
  },
}

export function riskStyle(level) {
  return RISK_STYLES[level] ?? RISK_STYLES.Laag
}
