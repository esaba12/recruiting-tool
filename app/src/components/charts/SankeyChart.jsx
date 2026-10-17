import { useRef, useState } from 'react'
import { Sankey, ResponsiveContainer } from 'recharts'
import { useChartTheme } from './theme.js'

// Application outcome flow (lib/applicationFlow.js's { nodes, links }). Presentation
// only. Every node is direct-labeled with its count, which is both the identity channel
// and the contrast relief theme.js's flow palette needs. Bands into an outcome take
// that outcome's color; everything upstream stays a recessive neutral so the eye lands
// on where things ended up. `onSelect({ label, appIds })` fires on a band or node click.
// Only the two verdicts get a strong band; the neutral outcomes stay as quiet as the
// upstream flow so they don't out-shout Rejected/Accepted.
const STATUS_OUTCOME = new Set(['Accepted', 'Rejected', 'Referral', 'Gone cold'])

// `palette: 'network'` swaps in the networking outcome colors; `unit` names what a band counts.
export default function SankeyChart({ flow, height = 300, minWidth = 600, onSelect, selectedLabel, palette = 'application', unit = 'application' }) {
  const base = useChartTheme().flow
  const theme = palette === 'network' ? { ...base, outcome: base.networkOutcome } : base
  const wrap = useRef(null)
  const [hover, setHover] = useState(null)

  const colorFor = node =>
    node.kind === 'outcome' ? theme.outcome[node.name]
      : node.kind === 'source' ? theme.source : theme.stage

  const place = (e, text) => {
    const r = wrap.current?.getBoundingClientRect()
    if (r) setHover({ text, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
  }

  const Node = ({ x, y, width, height: h, payload }) => {
    const label = `${payload.name} · ${payload.value}`
    const selected = selectedLabel === payload.name
    return (
      <g
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
        onClick={() => onSelect?.({ label: payload.name, appIds: payload.appIds })}
        onMouseMove={e => place(e, `${payload.name}: ${payload.value} ${unit}${payload.value === 1 ? '' : 's'}`)}
        onMouseLeave={() => setHover(null)}
      >
        {/* hit target wider than the 8px bar */}
        <rect x={x - 6} y={y - 2} width={width + 12} height={Math.max(h + 4, 12)} fill="transparent" />
        <rect x={x} y={y} width={width} height={Math.max(h, 2)} rx={2} fill={colorFor(payload)}
          stroke={selected ? theme.label : 'none'} strokeWidth={selected ? 1.5 : 0} />
        <text
          x={x + width + 6} y={y + h / 2} dy="0.35em"
          fontSize={11} fontWeight={selected ? 600 : 500} fill={theme.label}
          style={{ fontFamily: 'var(--font-mono, ui-monospace)', pointerEvents: 'none' }}
          paintOrder="stroke" stroke="var(--color-surface)" strokeWidth={3} strokeLinejoin="round"
        >{label}</text>
      </g>
    )
  }

  const Link = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) => {
    const target = payload.target
    const into = target.kind === 'outcome' ? theme.outcome[target.name] : theme.link
    const label = `${payload.source.name} → ${target.name}`
    const selected = selectedLabel === label
    const dim = selectedLabel && !selected
    const est = payload.estimated
    return (
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none" stroke={into} strokeWidth={Math.max(linkWidth, 1)}
        strokeOpacity={selected ? 0.75 : dim ? 0.12 : STATUS_OUTCOME.has(target.name) ? 0.42 : 0.28}
        style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'stroke-opacity 120ms' }}
        onClick={() => onSelect?.({ label, appIds: payload.appIds })}
        onMouseEnter={e => { e.currentTarget.style.strokeOpacity = 0.75 }}
        onMouseMove={e => place(e, `${label}: ${payload.value}${est ? ` (${est} estimated)` : ''}`)}
        onMouseLeave={e => { e.currentTarget.style.strokeOpacity = ''; setHover(null) }}
      />
    )
  }

  if (!flow?.links?.length) return null
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div ref={wrap} className="relative" style={{ minWidth, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={flow}
            node={Node}
            link={Link}
            nodeWidth={8}
            nodePadding={22}
            sort={false}
            iterations={64}
            margin={{ top: 8, right: 118, bottom: 8, left: 8 }}
          />
        </ResponsiveContainer>
        {hover && (
          <div
            className="absolute pointer-events-none bg-surface border border-ink-300 rounded-md px-2.5 py-1.5 text-xs text-ink-700 whitespace-nowrap z-10"
            style={{ left: Math.min(hover.x + 12, hover.w - 200), top: hover.y + 12 }}
          >{hover.text}</div>
        )}
      </div>
    </div>
  )
}
