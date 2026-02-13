// changed based on hw2 feedback










// import React, { useEffect, useRef, useState } from 'react'
// import * as d3 from 'd3'
// import { isEmpty } from 'lodash'
// import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

// import { ComponentSize, Margin } from '../types'
// import csvPastUrl from '../../data/track_data_final.csv?url'
// import csv2025Url from '../../data/spotify_data_clean.csv?url'

// type Row = {
//   track_popularity: number
//   artist_popularity: number
//   artist_followers: number
//   track_duration_min: number
//   explicit: string
//   album_release_date: string
// }

// // nan -> !0
// const parseNumber = (v: unknown) => {
//   if (v === null || v === undefined) return NaN
//   const s = String(v).trim()
//   if (s === '') return NaN
//   const n = Number(s)
//   return Number.isFinite(n) ? n : NaN
// }

// export default function Streamgraph() {
//   const chartRef = useRef<HTMLDivElement>(null)
//   const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
//   const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
//   useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })

//   const margin: Margin = { top: 28, right: 18, bottom: 44, left: 54 }

//   const [rows, setRows] = useState<Row[]>([])

//   useEffect(() => {
//     const load = async () => {
//       try {
//         const csvpastData = await d3.csv(csvPastUrl, (d) => ({
//           track_popularity: parseNumber(d.track_popularity),
//           artist_popularity: parseNumber(d.artist_popularity),
//           artist_followers: parseNumber(d.artist_followers),
//           track_duration_min: parseNumber(d.track_duration_ms) / 60000, // ms -> min
//           explicit: (d.explicit ?? '').toString(),
//           album_release_date: (d.album_release_date ?? '').toString(),
//         }))

//         const csv2025Data = await d3.csv(csv2025Url, (d) => ({
//           track_popularity: parseNumber(d.track_popularity),
//           artist_popularity: parseNumber(d.artist_popularity),
//           artist_followers: parseNumber(d.artist_followers),
//           track_duration_min: parseNumber(d.track_duration_min),
//           explicit: (d.explicit ?? '').toString(),
//           album_release_date: (d.album_release_date ?? '').toString(),
//         }))

//         const combinedData = [...csvpastData, ...csv2025Data]
//           .filter((d) => Number.isFinite(d.track_popularity) && Number.isFinite(d.artist_popularity))
//           .filter((d) => Number.isFinite(d.artist_followers) && Number.isFinite(d.track_duration_min))

//         setRows(combinedData)
//       } catch (e) {
//         console.error('Error loading CSV:', e)
//       }
//     }
//     load();
//   }, [])

//   useEffect(() => {
//     if (isEmpty(rows)) return
//     if (size.width === 0 || size.height === 0) return
//     d3.select('#stream-svg').selectAll('*').remove()
//     initChart()
//   }, [rows, size])

//   function initChart() {
//     const svg = d3.select('#stream-svg')
//     const w = size.width
//     const h = size.height

//     const isNarrow = w < 680
//     const m: Margin = {
//       ...margin,
//       top: isNarrow ? 88 : 72,
//       bottom: isNarrow ? 56 : 52,
//     }

//     const innerW = Math.max(0, w - m.left - m.right)
//     const innerH = Math.max(0, h - m.top - m.bottom - 10)

//     // hw3 fix: avoid mixing incomparable units in the overview chart

//     const parseYMD = d3.timeParse('%Y-%m-%d')
//     const parseYM = d3.timeParse('%Y-%m')
//     const parseY = d3.timeParse('%Y')
//     const toDate = (s: string) => {
//       const raw = String(s).trim()
//       if (raw === '') return null
//       const y = Number(raw.slice(0, 4))
//       if (Number.isFinite(y) && y < 1900) return null
//       return parseYMD(raw) ?? parseYM(raw) ?? parseY(raw) ?? null
//     }

//     const rowsWithDate = rows
//       .map((d) => ({ ...d, _date: toDate(d.album_release_date) }))
//       .filter((d) => d._date !== null) as (Row & { _date: Date })[]

//     const byYear = d3.group(rowsWithDate, (d) => d._date.getFullYear())
//     const years = Array.from(byYear.keys()).filter(Number.isFinite).sort(d3.ascending)

//     const agg = years.map((year) => {
//       const arr = byYear.get(year) ?? []
//       return {
//         year,
//         track_popularity: d3.mean(arr, (d) => d.track_popularity) ?? 0,
//         artist_popularity: d3.mean(arr, (d) => d.artist_popularity) ?? 0,
//         count: arr.length,
//       }
//     })

//     if (agg.length === 0) return

//     const [minYear, maxYear] = d3.extent(agg, (d) => d.year) as [number, number]

//     const x = d3.scaleLinear().domain([minYear, maxYear]).range([0, innerW])
//     const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0])

//     const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

//     const tickCount = Math.max(4, Math.min(12, Math.floor(innerW / 90)))
//     g.append('g')
//       .attr('transform', `translate(0,${innerH})`)
//       .call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.format('d')))
//       .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
//       .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

//     g.append('g')
//       .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
//       .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
//       .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

//     g.append('text')
//       .attr('x', innerW / 2)
//       .attr('y', innerH + 38)
//       .attr('text-anchor', 'middle')
//       .attr('fill', '#A7A7A7')
//       .style('font-size', '12px')
//       .text('Release Year')

//     g.append('text')
//       .attr('transform', `translate(${-44}, ${innerH / 2}) rotate(-90)`)
//       .attr('text-anchor', 'middle')
//       .attr('fill', '#A7A7A7')
//       .style('font-size', '12px')
//       .text('Average popularity (0–100)')

//     const colors = {
//       track: '#1DB954',
//       artist: '#FFB020',
//     }

//     const trackLine = d3
//       .line<(typeof agg)[number]>()
//       .x((d) => x(d.year))
//       .y((d) => y(d.track_popularity))
//       .curve(d3.curveMonotoneX)

//     const artistLine = d3
//       .line<(typeof agg)[number]>()
//       .x((d) => x(d.year))
//       .y((d) => y(d.artist_popularity))
//       .curve(d3.curveMonotoneX)

//     g.append('path')
//       .datum(agg)
//       .attr('fill', 'none')
//       .attr('stroke', colors.track)
//       .attr('stroke-width', 2)
//       .attr('stroke-opacity', 0.9)
//       .attr('d', trackLine)

//     g.append('path')
//       .datum(agg)
//       .attr('fill', 'none')
//       .attr('stroke', colors.artist)
//       .attr('stroke-width', 2)
//       .attr('stroke-opacity', 0.85)
//       .attr('d', artistLine)

//     const tooltipText = (d: (typeof agg)[number]) =>
//       `Year: ${d.year}\nTrack popularity avg: ${d.track_popularity.toFixed(1)}\nArtist popularity avg: ${d.artist_popularity.toFixed(1)}\nN=${d.count}`

//     g.append('g')
//       .selectAll('circle.track')
//       .data(agg)
//       .join('circle')
//       .attr('class', 'track')
//       .attr('cx', (d) => x(d.year))
//       .attr('cy', (d) => y(d.track_popularity))
//       .attr('r', 2.2)
//       .attr('fill', colors.track)
//       .attr('fill-opacity', 0.85)
//       .append('title')
//       .text(tooltipText)

//     g.append('g')
//       .selectAll('circle.artist')
//       .data(agg)
//       .join('circle')
//       .attr('class', 'artist')
//       .attr('cx', (d) => x(d.year))
//       .attr('cy', (d) => y(d.artist_popularity))
//       .attr('r', 2.2)
//       .attr('fill', colors.artist)
//       .attr('fill-opacity', 0.8)
//       .append('title')
//       .text(tooltipText)

//     const annoYear = 2025
//     if (annoYear >= minYear && annoYear <= maxYear) {
//       g.append('line')
//         .attr('x1', x(annoYear))
//         .attr('x2', x(annoYear))
//         .attr('y1', 0)
//         .attr('y2', innerH)
//         .attr('stroke', '#2A2A2A')
//         .attr('stroke-dasharray', '4 4')

//       g.append('text')
//         .attr('x', x(annoYear) + 6)
//         .attr('y', 10)
//         .attr('fill', '#A7A7A7')
//         .style('font-size', '10px')
//         .style('font-weight', 700)
//         .text('2025')
//     }

//     const legend = svg.append('g').attr('transform', `translate(${m.left}, ${40})`)
//     const items = [
//       { label: 'Track popularity (avg)', c: colors.track },
//       { label: 'Artist popularity (avg)', c: colors.artist },
//     ]

//     const row = legend
//       .selectAll('g')
//       .data(items)
//       .join('g')
//       .attr('transform', (_, i) => `translate(${i * 190}, 0)`)

//     row
//       .append('line')
//       .attr('x1', 0)
//       .attr('x2', 18)
//       .attr('y1', -4)
//       .attr('y2', -4)
//       .attr('stroke', (d) => d.c)
//       .attr('stroke-width', 3)

//     row
//       .append('text')
//       .attr('x', 24)
//       .attr('y', 0)
//       .attr('fill', '#A7A7A7')
//       .style('font-size', isNarrow ? '11px' : '12px')
//       .style('font-weight', 700)
//       .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))')
//       .text((d) => d.label)
//   }

//   return (
//     <div ref={chartRef} className="chart-container">
//       <svg id="stream-svg" width="100%" height="100%" />
//     </div>
//   )
// }
