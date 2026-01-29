import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

// past: 2009-2023 (track_data_final)
// 2025: modern tracks (spotify_data_clean)
import csvPastUrl from '../../data/track_data_final.csv?url'
import csv2025Url from '../../data/spotify_data_clean.csv?url'

type Row = {
  track_popularity: number
  artist_popularity: number
  artist_followers: number
  track_duration_min: number
  explicit: string
}

type MetricKey = 'track_popularity' | 'artist_popularity' | 'followers_log' | 'duration_min' | 'explicit_rate'

type Metric = {
  key: MetricKey
  label: string
  value: (d: Row) => number
}

type RadarDatum = {
  key: MetricKey
  label: string
  v: number // 0..1
}

export default function StarPlot() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 16, right: 16, bottom: 16, left: 16 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })


  const [pastRows, setPastRows] = useState<Row[]>([])
  const [y2025Rows, setY2025Rows] = useState<Row[]>([])

  const metrics: Metric[] = [
    { key: 'track_popularity', label: 'Track Pop', value: (d) => d.track_popularity },
    { key: 'artist_popularity', label: 'Artist Pop', value: (d) => d.artist_popularity },
    { key: 'followers_log', label: 'Followers', value: (d) => Math.log10(Math.max(1, d.artist_followers)) },
    { key: 'duration_min', label: 'Duration', value: (d) => d.track_duration_min },
    { key: 'explicit_rate', label: 'Explicit', value: (d) => (String(d.explicit).toLowerCase() === 'true' ? 1 : 0) },
  ]

  useEffect(() => {
    const load = async () => {
      try {
        // track_data_final
        const past = await d3.csv(csvPastUrl, (d) => ({
          track_popularity: +(d.track_popularity ?? 0),
          artist_popularity: +(d.artist_popularity ?? 0),
          artist_followers: +(d.artist_followers ?? 0),
          track_duration_min: +(d.track_duration_ms ?? 0) / 60000,
          explicit: (d.explicit ?? '').toString(),
        }))

        // spotify_data_clean
        const y2025 = await d3.csv(csv2025Url, (d) => ({
          track_popularity: +(d.track_popularity ?? 0),
          artist_popularity: +(d.artist_popularity ?? 0),
          artist_followers: +(d.artist_followers ?? 0),
          track_duration_min: +(d.track_duration_min ?? 0),
          explicit: (d.explicit ?? '').toString(),
        }))

        const clean = (arr: Row[]) =>
          arr.filter(
            (d) =>
              Number.isFinite(d.track_popularity) &&
              Number.isFinite(d.artist_popularity) &&
              Number.isFinite(d.artist_followers) &&
              Number.isFinite(d.track_duration_min),
          )

        setPastRows(clean(past));
        setY2025Rows(clean(y2025));
      } catch (error) {
        console.error('Error loading CSV:', error)
      }
    }

    load()
  }, [])


  useEffect(() => {
    if (size.width === 0 || size.height === 0) return
    if (isEmpty(pastRows) || isEmpty(y2025Rows)) return
    d3.select('#star-svg').selectAll('*').remove()
    initChart()
  }, [pastRows, y2025Rows, size])

  function initChart() {
    const svg = d3.select('#star-svg')

    const w = size.width
    const h = size.height
    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)

    const cx = margin.left + innerW / 2
    const cy = margin.top + innerH / 2
    const R = Math.min(innerW, innerH) / 2 - 28

    //normalize (struggle to highlight the difference between two data)
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
    type Stat = { lo: number; hi: number }
    const statByKey = new Map<MetricKey, Stat>()

    for (const m of metrics) {
      const vals = pastRows
        .map(m.value)
        .filter((v) => Number.isFinite(v))
        .sort(d3.ascending)

      const lo = d3.quantile(vals, 0.25) ?? vals[0] ?? 0
      const hi = d3.quantile(vals, 0.75) ?? vals[vals.length - 1] ?? lo + 1
      statByKey.set(m.key, lo === hi ? { lo, hi: lo + 1 } : { lo, hi })
    }

    const BASE = 0.5
    const AMPLIFY = 6

    const pastMeanByKey = new Map<MetricKey, number>()
    const y2025MeanByKey = new Map<MetricKey, number>()
    for (const m of metrics) {
      pastMeanByKey.set(m.key, d3.mean(pastRows, m.value) ?? 0)
      y2025MeanByKey.set(m.key, d3.mean(y2025Rows, m.value) ?? 0)
    }

    const pastRadar: RadarDatum[] = metrics.map((m) => ({
      key: m.key,
      label: m.label,
      v: BASE,
    }))

    const y2025Radar: RadarDatum[] = metrics.map((m) => {
      const st = statByKey.get(m.key) ?? { lo: 0, hi: 1 }
      const range = st.hi - st.lo || 1
      const a = pastMeanByKey.get(m.key) ?? 0
      const b = y2025MeanByKey.get(m.key) ?? 0
      const delta = (b - a) / range
      return { key: m.key, label: m.label, v: clamp01(BASE + delta * AMPLIFY) }
    })


    

    // radar outline
    const angle = d3
      .scaleLinear()
      .domain([0, metrics.length])
      .range([-Math.PI / 2, -Math.PI / 2 + Math.PI * 2])

    const radius = d3.scaleLinear().domain([0, 1]).range([0, R])

    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]
    svg
      .append('g')
      .selectAll('circle')
      .data(gridLevels)
      .join('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', (d) => radius(d))
      .attr('fill', 'none')
      .attr('stroke', '#2A2A2A')


    const axes = svg.append('g')

    axes
      .selectAll('line')
      .data(metrics)
      .join('line')
      .attr('x1', cx)
      .attr('y1', cy)
      .attr('x2', (_, i) => cx + radius(1) * Math.cos(angle(i)))
      .attr('y2', (_, i) => cy + radius(1) * Math.sin(angle(i)))
      .attr('stroke', '#2A2A2A')

    axes
      .selectAll('text')
      .data(metrics)
      .join('text')
      .attr('x', (_, i) => cx + (radius(1) + 12) * Math.cos(angle(i)))
      .attr('y', (_, i) => cy + (radius(1) + 12) * Math.sin(angle(i)))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '11px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text((d) => d.label)

    

    const makePoints = (arr: RadarDatum[]) =>
      arr
        .map((d, i) => {
          const a = angle(i)
          const rr = radius(d.v)
          return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
        })
        .join(' ')

    // gray: track_data_final(past-average)
    svg
      .append('polygon')
      .attr('points', makePoints(pastRadar))
      .attr('fill', 'none')
      .attr('stroke', '#B0B0B0')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.95)
      .attr('stroke-dasharray', '6 4')

    // green: spotify_data_clean（2025）
    svg
      .append('polygon')
      .attr('points', makePoints(y2025Radar))
      .attr('fill', '#1DB954')
      .attr('fill-opacity', 0.10)
      .attr('stroke', '#1ED760')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.9)
    
    // attempted to show % to highligh the difference -> but this doesn't look right
    // svg
    // .append('g')
    // .selectAll('text')
    // .data(deltas)
    // .join('text')
    // .attr('x', (_, i) => cx + (radius(1) + 28) * Math.cos(angle(i)))
    // .attr('y', (_, i) => cy + (radius(1) + 28) * Math.sin(angle(i)))
    // .attr('text-anchor', 'middle')
    // .attr('dominant-baseline', 'middle')
    // .style('font-size', '10px')
    // .style('font-weight', 700)
    // .attr('fill', (d) => (d.pct >= 0 ? '#1ED760' : '#FF6F61'))
    // .text((d) => `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%`)


    // title
    svg
      .append('text')
      .attr('x', margin.left + 8)
      .attr('y', 18)
      .attr('fill', '#EDEDED')
      .style('font-weight', 700)
      .style('font-size', '13px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 4)
      .style('stroke-linejoin', 'round')
      .text(`[past baseline @0.5] vs [2025 delta] (amplified x${AMPLIFY})`)

    // label
    const legend = svg.append('g').attr('transform', `translate(${margin.left + 8}, ${margin.top + 26})`)

    legend
      .append('circle')
      .attr('cx', 6)
      .attr('cy', 6)
      .attr('r', 4)
      .attr('fill', '#B0B0B0')
      .attr('fill-opacity', 0.85)

    legend
      .append('text')
      .attr('x', 16)
      .attr('y', 9)
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text('Past baseline (track_data_final)')

    legend
      .append('circle')
      .attr('cx', 6)
      .attr('cy', 26)
      .attr('r', 4)
      .attr('fill', '#1DB954')
      .attr('fill-opacity', 0.9)

    legend
      .append('text')
      .attr('x', 16)
      .attr('y', 29)
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text('2025 delta (spotify_data_clean)')
  }

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="star-svg" width="100%" height="100%" />
    </div>
  )
}
