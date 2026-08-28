import { useState } from 'react'
import { getDimensionAnchor } from '../../i18n/labels'

// Keuzeveld als knoppenrij i.p.v. dropdown, met onder de rij de betekenis van
// de gekozen optie plus een concreet voorbeeld.
//
// Waarom knoppen en geen dropdown: bij een inschatting wil je de hele schaal
// zien om je antwoord te kunnen plaatsen. In een dropdown moet je eerst
// klikken om te ontdekken wát de opties zijn, en zie je ze nooit naast elkaar.
//
// Waarom de ankertekst: dat is de belangrijkste rem op subjectief invullen —
// mensen kiezen betrouwbaarder tussen situaties die ze herkennen dan tussen
// abstracte woorden. Hoveren of tabben toont het anker van een optie zonder
// je keuze te wijzigen, want juist als je twijfelt wil je kunnen vergelijken.
export default function SegmentedField({
  id,
  label,
  dimension,
  options,
  value,
  onChange,
  onBlur,
  translate,
  language,
  required = false,
  children,
}) {
  // Welk voorbeeld getoond wordt, per optie onthouden: wisselen van optie en
  // terugkomen laat dan hetzelfde voorbeeld zien i.p.v. terug te springen.
  const [voorbeeldIndex, setVoorbeeldIndex] = useState({})
  const [preview, setPreview] = useState(null)

  const getoond = preview ?? value
  const anchor = getoond ? getDimensionAnchor(dimension, getoond, language) : null
  const voorbeelden = anchor?.voorbeelden ?? []
  const index = voorbeelden.length ? (voorbeeldIndex[getoond] ?? 0) % voorbeelden.length : 0

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="block text-xs font-medium text-slate-600" htmlFor={id}>
          {label}
          {required && (
            <span className="ml-0.5 text-slate-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {children}
      </div>

      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        onMouseLeave={() => setPreview(null)}
        className="flex gap-0.5 rounded-md border border-slate-300 bg-white p-0.5"
      >
        {options.map((optie) => {
          const actief = value === optie
          return (
            <button
              key={optie}
              type="button"
              role="radio"
              aria-checked={actief}
              onClick={() => onChange(optie)}
              onBlur={onBlur}
              onMouseEnter={() => setPreview(optie)}
              onFocus={() => setPreview(optie)}
              className={`min-w-0 flex-1 truncate rounded py-1 transition-colors ${
                // Vijf opties passen alleen met krappere knoppen en kleinere
                // tekst; daaronder blijft de normale maat.
                options.length > 4 ? 'px-1 text-xs' : 'px-1.5 text-[13px]'
              } ${actief ? 'bg-[#2a5f8a] font-medium text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {translate(optie, language)}
            </button>
          )
        })}
      </div>

      {/* De ankerregel staat er altijd, ook leeg: verscheen hij pas bij een
          keuze, dan sprong alles eronder omlaag zodra je een optie aanwees.
          Twee regels ruimte dekt vrijwel elke betekenis-plus-voorbeeld. */}
      <p
        className={`mt-1.5 flex min-h-[2.4rem] gap-1.5 text-xs leading-relaxed ${
          preview ? 'text-slate-600' : 'text-slate-500'
        }`}
      >
        {anchor && (
          <>
            <span className={preview ? 'text-[#2a5f8a]' : 'text-slate-300'} aria-hidden="true">
              →
            </span>
            <span>
              {anchor.betekenis}
              {voorbeelden.length > 0 && <em className="ml-1 not-italic text-slate-400">{voorbeelden[index]}</em>}
              {voorbeelden.length > 1 && (
                <button
                  type="button"
                  onClick={() => setVoorbeeldIndex((prev) => ({ ...prev, [getoond]: index + 1 }))}
                  title={`Ander voorbeeld (${index + 1} van ${voorbeelden.length})`}
                  aria-label="Ander voorbeeld"
                  className="ml-1 rounded text-slate-300 hover:text-[#2a5f8a] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2a5f8a]"
                >
                  ↻
                </button>
              )}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
