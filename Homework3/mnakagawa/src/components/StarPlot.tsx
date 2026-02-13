// changed based on hw2 feedback

// import React, { useEffect, useRef, useState } from 'react'
// import * as d3 from 'd3'
// import { isEmpty } from 'lodash'
// import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

// import { ComponentSize, Margin } from '../types'

// // past: 2009-2023 (track_data_final)
// // 2025: tracks (spotify_data_clean)
// import csvPastUrl from '../../data/track_data_final.csv?url'
// import csv2025Url from '../../data/spotify_data_clean.csv?url'

// type Row = {
//   track_popularity: number
//   artist_popularity: number
//   artist_followers: number
//   track_duration_min: number
//   explicit: string
// }

// type MetricKey = 'track_popularity' | 'artist_popularity' | 'artist_followers' | 'duration_min' | 'explicit_rate'

// type Metric = {
//   key: MetricKey
//   label: string
//   value: (d: Row) => number
// }

// type RadarDatum = {
//   key: MetricKey
//   label: string
//   v: number // 0..1
// }


// const parseNumber = (v: unknown) => {
//   if (v === null || v === undefined) return NaN
//   const s = String(v).trim()
//   if (s === '') return NaN
//   const n = Number(s)
//   return Number.isFinite(n) ? n : NaN
// }

// export default function StarPlot() {
//   const chartRef = useRef<HTMLDivElement>(null)
//   const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
//   const margin: Margin = { top: 16, right: 16, bottom: 16, left: 16 }
//   const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
//   useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })


//   const [pastRows, setPastRows] = useState<Row[]>([])
//   const [y2025Rows, setY2025Rows] = useState<Row[]>([])

//   const metrics: Metric[] = [
//     { key: 'track_popularity', label: 'Track Popularity', value: (d) => d.track_popularity },
//     { key: 'artist_popularity', label: 'Artist Popularity', value: (d) => d.artist_popularity },
//     { key: 'artist_followers', label: 'Artist Followers', value: (d) => d.artist_followers },
//     { key: 'duration_min', label: 'Song Duration', value: (d) => d.track_duration_min },
//     { key: 'explicit_rate', label: 'Explicit', value: (d) => (String(d.explicit).toLowerCase() === 'true' ? 1 : 0) },
//   ]

//   useEffect(() => {
//     const load = async () => {
//       try {
//         // track_data_final
//         const past = await d3.csv(csvPastUrl, (d) => ({
//           track_popularity: parseNumber(d.track_popularity),
//           artist_popularity: parseNumber(d.artist_popularity),
//           artist_followers: parseNumber(d.artist_followers),
//           track_duration_min: parseNumber(d.track_duration_ms) / 60000,
//           explicit: (d.explicit ?? '').toString(),
//         }))

//         // spotify_data_clean
//         const y2025 = await d3.csv(csv2025Url, (d) => ({
//           track_popularity: parseNumber(d.track_popularity),
//           artist_popularity: parseNumber(d.artist_popularity),
//           artist_followers: parseNumber(d.artist_followers),
//           track_duration_min: parseNumber(d.track_duration_min),
//           explicit: (d.explicit ?? '').toString(),
//         }))

//         const clean = (arr: Row[]) =>
//           arr.filter(
//             (d) =>
//               Number.isFinite(d.track_popularity) &&
//               Number.isFinite(d.artist_popularity) &&
//               Number.isFinite(d.artist_followers) &&
//               Number.isFinite(d.track_duration_min),
//           )

//         setPastRows(clean(past));
//         setY2025Rows(clean(y2025));
//       } catch (error) {
//         console.error('Error loading CSV:', error)
//       }
//     }

//     load();
//   }, [])


//   useEffect(() => {
//     if (size.width === 0 || size.height === 0) return
//     if (isEmpty(pastRows) || isEmpty(y2025Rows)) return
//     d3.select('#star-svg').selectAll('*').remove()
//     initChart()
//   }, [pastRows, y2025Rows, size])

//   function initChart() {
//     const svg = d3.select('#star-svg')

//     const w = size.width
//     const h = size.height
//     const innerW = Math.max(0, w - margin.left - margin.right)
//     const innerH = Math.max(0, h - margin.top - margin.bottom)

//     const cx = margin.left + innerW / 2
//     const cy = margin.top + innerH / 2
//     const R = Math.min(innerW, innerH) / 2 - 28

//     const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

//     // hw3 fix: normalize by actual value extents (not baseline/IQR deltas)
//     const pastMeanByKey = new Map<MetricKey, number>()
//     const y2025MeanByKey = new Map<MetricKey, number>()
//     for (const m of metrics) {
//       pastMeanByKey.set(m.key, d3.mean(pastRows, m.value) ?? 0)
//       y2025MeanByKey.set(m.key, d3.mean(y2025Rows, m.value) ?? 0)
//     }

//     const allRows = [...pastRows, ...y2025Rows]
//     const followersLog = (v: number) => Math.log10(Math.max(1, v))

//     const domainForKey = (k: MetricKey): [number, number] => {
//       if (k === 'track_popularity' || k === 'artist_popularity') return [0, 100]
//       if (k === 'explicit_rate') return [0, 1]
//       if (k === 'artist_followers') {
//         const vals = allRows.map((d) => followersLog(d.artist_followers)).filter(Number.isFinite)
//         const e = d3.extent(vals) as [number, number]
//         const min = e[0] ?? 0
//         const max = e[1] ?? min + 1
//         return min === max ? [min, min + 1] : [min, max]
//       }
//       const vals = allRows.map((d) => d.track_duration_min).filter(Number.isFinite)
//       const e = d3.extent(vals) as [number, number]
//       const min = e[0] ?? 0
//       const max = e[1] ?? min + 1
//       return min === max ? [min, min + 1] : [min, max]
//     }

//     const toScaled = (k: MetricKey, v: number) => (k === 'artist_followers' ? followersLog(v) : v)
//     const toNorm = (k: MetricKey, v: number) => {
//       const [min, max] = domainForKey(k)
//       const sv = toScaled(k, v)
//       const t = (sv - min) / (max - min)
//       return clamp01(Number.isFinite(t) ? t : 0.5)
//     }

//     const pastRadar: RadarDatum[] = metrics.map((m) => ({
//       key: m.key,
//       label: m.label,
//       v: toNorm(m.key, pastMeanByKey.get(m.key) ?? 0),
//     }))

//     const y2025Radar: RadarDatum[] = metrics.map((m) => ({
//       key: m.key,
//       label: m.label,
//       v: toNorm(m.key, y2025MeanByKey.get(m.key) ?? 0),
//     }))

//     const formatValue = (key: MetricKey, v: number) => {
//       if (key === 'explicit_rate') return `${(v * 100).toFixed(1)}%`
//       if (key === 'duration_min') return `${v.toFixed(2)} min`
//       if (key === 'artist_followers') return d3.format('.2s')(Math.max(0, v))
//       return `${Math.round(v)}`
//     }

//     const extentText = (key: MetricKey) => {
//       if (key === 'track_popularity' || key === 'artist_popularity') return '0–100'
//       if (key === 'explicit_rate') return '0–100%'
//       if (key === 'duration_min') {
//         const e = d3.extent(allRows, (d) => d.track_duration_min) as [number, number]
//         const min = e[0] ?? 0
//         const max = e[1] ?? min
//         return `${min.toFixed(1)}–${max.toFixed(1)} min`
//       }
//       const e = d3.extent(allRows, (d) => d.artist_followers) as [number, number]
//       const min = e[0] ?? 0
//       const max = e[1] ?? min
//       return `${d3.format('.2s')(min)}–${d3.format('.2s')(max)} (log)`
//     }


//     // radar outline
//     const angle = d3
//       .scaleLinear()
//       .domain([0, metrics.length])
//       .range([-Math.PI / 2, -Math.PI / 2 + Math.PI * 2])

//     const radius = d3.scaleLinear().domain([0, 1]).range([0, R])

//     const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]
//     svg
//       .append('g')
//       .selectAll('circle')
//       .data(gridLevels)
//       .join('circle')
//       .attr('cx', cx)
//       .attr('cy', cy)
//       .attr('r', (d) => radius(d))
//       .attr('fill', 'none')
//       .attr('stroke', '#2A2A2A')


//     const axes = svg.append('g')

//     axes
//       .selectAll('line')
//       .data(metrics)
//       .join('line')
//       .attr('x1', cx)
//       .attr('y1', cy)
//       .attr('x2', (_, i) => cx + radius(1) * Math.cos(angle(i)))
//       .attr('y2', (_, i) => cy + radius(1) * Math.sin(angle(i)))
//       .attr('stroke', '#2A2A2A')

//     axes
//       .selectAll('text')
//       .data(metrics)
//       .join('text')
//       .attr('x', (_, i) => cx + (radius(1) + 22) * Math.cos(angle(i)))
//       .attr('y', (_, i) => cy + (radius(1) + 22) * Math.sin(angle(i)))
//       .attr('text-anchor', 'middle')
//       .attr('dominant-baseline', 'middle')
//       .style('font-size', '11px')
//       .style('font-weight', 700)
//       .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))')
//       .each(function (d) {
//         const sel = d3.select(this)
//         const x0 = sel.attr('x')

//         sel.selectAll('*').remove()

//         sel
//           .append('tspan')
//           .attr('x', x0)
//           .attr('dy', '0')
//           .attr('fill', '#A7A7A7')
//           .text(d.label)

//         sel
//           .append('tspan')
//           .attr('x', x0)
//           .attr('dy', '1.15em')
//           .style('font-size', '10px')
//           .attr('fill', '#8F8F8F')
//           .style('font-weight', 700)
//           .text(`Extent: ${extentText(d.key)}`)

//         const pastAvg = formatValue(d.key, pastMeanByKey.get(d.key) ?? 0)
//         const y2025Avg = formatValue(d.key, y2025MeanByKey.get(d.key) ?? 0)
//         sel
//           .append('tspan')
//           .attr('x', x0)
//           .attr('dy', '1.15em')
//           .attr('fill', '#c1c1c1')
//           .style('font-size', '10px')
//           .style('font-weight', 700)
//           .text(`Avg: past ${pastAvg} | 2025 ${y2025Avg}`)
//       })


//     const makePoints = (arr: RadarDatum[]) =>
//       arr
//         .map((d, i) => {
//           const a = angle(i)
//           const rr = radius(d.v)
//           return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
//         })
//         .join(' ')

//     // gray: track_data_final(past-average)
//     svg
//       .append('polygon')
//       .attr('points', makePoints(pastRadar))
//       .attr('fill', 'none')
//       .attr('stroke', '#B0B0B0')
//       .attr('stroke-width', 2)
//       .attr('stroke-opacity', 0.95)
//       .attr('stroke-dasharray', '6 4')

//     // green: spotify_data_clean（2025）
//     svg
//       .append('polygon')
//       .attr('points', makePoints(y2025Radar))
//       .attr('fill', '#1DB954')
//       .attr('fill-opacity', 0.10)
//       .attr('stroke', '#1ED760')
//       .attr('stroke-width', 2)
//       .attr('stroke-opacity', 0.9)

//     // label
//     const legend = svg.append('g').attr('transform', `translate(${margin.left + 8}, ${margin.top + 15})`)

//     legend
//       .append('circle')
//       .attr('cx', 6)
//       .attr('cy', 6)
//       .attr('r', 4)
//       .attr('fill', '#B0B0B0')
//       .attr('fill-opacity', 0.85)

//     legend
//       .append('text')
//       .attr('x', 16)
//       .attr('y', 9)
//       .attr('fill', '#c1c1c1')
//       .style('font-size', '12px')
//       .style('paint-order', 'stroke')
//       .style('stroke', '#191414')
//       .style('stroke-width', 3)
//       .style('stroke-linejoin', 'round')
//       .text('Average of 2009-2023')

//     legend
//       .append('circle')
//       .attr('cx', 6)
//       .attr('cy', 26)
//       .attr('r', 4)
//       .attr('fill', '#1DB954')
//       .attr('fill-opacity', 0.9)

//     legend
//       .append('text')
//       .attr('x', 16)
//       .attr('y', 29)
//       .attr('fill', '#bebdbd')
//       .style('font-size', '12px')
//       .style('paint-order', 'stroke')
//       .style('stroke', '#191414')
//       .style('stroke-width', 3)
//       .style('stroke-linejoin', 'round')
//       .text('2025')
//   }

//   return (
//     <div ref={chartRef} className="chart-container">
//       <svg id="star-svg" width="100%" height="100%" />
//     </div>
//   )
// }
