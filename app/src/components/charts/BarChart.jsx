import { BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import ChartTooltip from './ChartTooltip.jsx'
import { useChartTheme } from './theme.js'

// Single-series magnitude chart — one flat hue (see theme.js for why: axis
// position already encodes any order, so color doesn't need to re-encode it).
// `orientation`: 'vertical' (columns, default) | 'horizontal' (bars)
export default function BarChart({ data, dataKey = 'value', labelKey = 'label', orientation = 'vertical', height = 200, formatter }) {
  const horizontal = orientation === 'horizontal'
  const { series: CHART_SERIES, grid: CHART_GRID, axisText: CHART_AXIS_TEXT } = useChartTheme()
  const tickStyle = { fill: CHART_AXIS_TEXT, fontSize: 11, fontFamily: 'Public Sans, sans-serif' }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: horizontal ? 8 : 20, right: horizontal ? 32 : 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={labelKey} tick={tickStyle} axisLine={false} tickLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={labelKey} tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ fill: CHART_GRID, opacity: 0.4 }} />
        <Bar dataKey={dataKey} fill={CHART_SERIES} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={24}>
          <LabelList dataKey={dataKey} position={horizontal ? 'right' : 'top'} style={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  )
}
