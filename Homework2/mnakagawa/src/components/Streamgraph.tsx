import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'
import csvPastUrl from '../../data/track_data_final.csv?url'
import csv2025Url from '../../data/spotify_data_clean.csv?url'

type Row = {
  track_popularity: number
  artist_popularity: number
  artist_followers: number
  track_duration_min: number
  explicit: string
  album_release_date: string
}

type YearAgg = {
  year: number
  [key: string]: number
}

// nan -> !0
const parseNumber = (v: unknown) => {
  if (v === null || v === undefined) return NaN
  const s = String(v).trim()
  if (s === '') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export default function Streamgraph() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })

  const margin: Margin = { top: 28, right: 18, bottom: 44, left: 54 }

  const [rows, setRows] = useState<Row[]>([])

  const seriesKeys = ['track_popularity', 'artist_popularity', 'followers_log', 'duration_min', 'explicit_rate'] as const

  useEffect(() => {
    const load = async () => {
      try {
        const csvpastData = await d3.csv(csvPastUrl, (d) => ({
          track_popularity: parseNumber(d.track_popularity),
          artist_popularity: parseNumber(d.artist_popularity),
          artist_followers: parseNumber(d.artist_followers),
          track_duration_min: parseNumber(d.track_duration_ms) / 60000, // ms -> min
          explicit: (d.explicit ?? '').toString(),
          album_release_date: (d.album_release_date ?? '').toString(),
        }))

        const csv2025Data = await d3.csv(csv2025Url, (d) => ({
          track_popularity: parseNumber(d.track_popularity),
          artist_popularity: parseNumber(d.artist_popularity),
          artist_followers: parseNumber(d.artist_followers),
          track_duration_min: parseNumber(d.track_duration_min),
          explicit: (d.explicit ?? '').toString(),
          album_release_date: (d.album_release_date ?? '').toString(),
        }))

        const combinedData = [...csvpastData, ...csv2025Data]
          .filter((d) => Number.isFinite(d.track_popularity) && Number.isFinite(d.artist_popularity))
          .filter((d) => Number.isFinite(d.artist_followers) && Number.isFinite(d.track_duration_min))

        setRows(combinedData)
      } catch (e) {
        console.error('Error loading CSV:', e)
      }
    }
    load();
  }, [])

  useEffect(() => {
    if (isEmpty(rows)) return
    if (size.width === 0 || size.height === 0) return
    d3.select('#stream-svg').selectAll('*').remove()
    initChart()
  }, [rows, size])

  function initChart() {
    const svg = d3.select('#stream-svg')

    const w = size.width
    const h = size.height

    const isNarrow = w < 680
    const m: Margin = {
      ...margin,
      top: isNarrow ? 88 : 72,
      bottom: isNarrow ? 56 : 52,
    }

    const innerW = Math.max(0, w - m.left - m.right)
    const innerH = Math.max(0, h - m.top - m.bottom -10)

    const labelByKey: Record<string, string> = {
      track_popularity: 'Track Popularity',
      artist_popularity: 'Artist Popularity',
      followers_log: 'Followers',
      duration_min: 'Duration (min)',
      explicit_rate: 'Explicit Rate',
    }

    const scheme =
      (d3.schemeYlGn as unknown as Record<number, string[]>)[seriesKeys.length] ??
      (d3.schemeYlGn as unknown as Record<number, string[]>)[9]
    const palette = (scheme ?? []).slice(0, seriesKeys.length)
    const color = d3.scaleOrdinal<string>().domain(seriesKeys as unknown as string[]).range(palette)


    // date
    const parseYMD = d3.timeParse('%Y-%m-%d')
    const parseYM = d3.timeParse('%Y-%m')
    const parseY = d3.timeParse('%Y')
    const toDate = (s: string) => {
      const raw = String(s).trim()
      if (raw === '') return null
      const y = Number(raw.slice(0, 4))
      if (Number.isFinite(y) && y < 1900) return null
      return parseYMD(raw) ?? parseYM(raw) ?? parseY(raw) ?? null
    }

    const rowsWithDate = rows
      .map((d) => ({ ...d, _date: toDate(d.album_release_date) }))
      .filter((d) => d._date !== null) as (Row & { _date: Date })[]
    
    const byBucket = d3.group(rowsWithDate, (d) => d3.timeYear(d._date).getTime())
    const buckets = Array.from(byBucket.keys()).sort((a, b) => a - b)

    const agg: YearAgg[] = buckets.map((t) => {
      const arr = byBucket.get(t) ?? []
      const date = new Date(t)
      const followersLog = (d: Row) => Math.log10(Math.max(1, d.artist_followers))
      const explicitRate = (d: Row) => (String(d.explicit).toLowerCase() === 'true' ? 1 : 0)

      return {
        year: date.getFullYear(),
        track_popularity: d3.mean(arr, (d) => d.track_popularity) ?? 0,
        artist_popularity: d3.mean(arr, (d) => d.artist_popularity) ?? 0,
        followers_log: d3.mean(arr, followersLog) ?? 0,
        duration_min: d3.mean(arr, (d) => d.track_duration_min) ?? 0,
        explicit_rate: d3.mean(arr, explicitRate) ?? 0,
      }
    })

    // normalize
    const extentByKey = new Map<string, [number, number]>()
    for (const k of seriesKeys) {
      const vals = agg.map((d) => d[k]).filter((v) => Number.isFinite(v))
      const e = d3.extent(vals) as [number, number]
      const min = e[0] ?? 0
      const max = e[1] ?? 1
      extentByKey.set(k, min === max ? [min, min + 1] : [min, max])
    }

    const norm = (k: string, v: number) => {
      const [min, max] = extentByKey.get(k) ?? [0, 1]
      return (v - min) / (max - min)
    }

    const normAgg: YearAgg[] = agg.map((d) => {
      const n = {
        track_popularity: norm('track_popularity', d.track_popularity),
        artist_popularity: norm('artist_popularity', d.artist_popularity),
        followers_log: norm('followers_log', d.followers_log),
        duration_min: norm('duration_min', d.duration_min),
        explicit_rate: norm('explicit_rate', d.explicit_rate),
      }

      const sum = seriesKeys.reduce((acc, k) => acc + (n[k] ?? 0), 0) || 1

      return {
        year: d.year,
        track_popularity: n.track_popularity / sum,
        artist_popularity: n.artist_popularity / sum,
        followers_log: n.followers_log / sum,
        duration_min: n.duration_min / sum,
        explicit_rate: n.explicit_rate / sum,
      }
    })

    // stacked area
    const stackGen = d3.stack<YearAgg>().keys(seriesKeys as unknown as string[])

    const stacked = stackGen(normAgg)

    const [minYear, maxYear] = d3.extent(agg, (d) => d.year) as [number, number]


    // x: year
    const x = d3
      .scaleLinear()
      .domain([minYear, maxYear])
       //   .nice()
      .range([0, innerW])

    // y: 100% stacked
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0])

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)

    // x-axis
    const tickCount = Math.max(4, Math.min(16, Math.floor(innerW / 70)))
    const rotateTicks = tickCount >= 9
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.format('d')))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))
      .call((gg) =>
        rotateTicks ? gg.selectAll('text').attr('transform', 'rotate(-25)').style('text-anchor', 'end') : gg,
      )

    // y-axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    // label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text('Release Year')

    g.append('text')
        .attr('transform', `translate(${-44}, ${innerH / 2}) rotate(-90)`)
        .attr('text-anchor', 'middle')
        .attr('fill', '#A7A7A7')
        .style('font-size', '12px')
        .text('Share of normalized feature mix (100% stacked)')



    const legendItems = ([...seriesKeys].reverse() as unknown as string[]).map((k) => ({
      key: k,
      label: labelByKey[k] ?? k,
    }))

    let lx = 0
    let ly = 0
    const rowH = 18
    const swatchW = 10
    const swatchGap = 6
    const padX = 14
    const legendMaxW = innerW

    const legendLayout = legendItems.map((d) => {
      const est = swatchW + swatchGap + d.label.length * 7 + padX
      if (lx + est > legendMaxW && lx > 0) {
        lx = 0
        ly += rowH
      }
      const out = { ...d, x: lx, y: ly }
      lx += est
      return out
    })

    const legend = svg.append('g').attr('transform', `translate(${m.left}, ${40})`)

    const legendRow = legend
      .selectAll('g')
      .data(legendLayout)
      .join('g')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)

    legendRow
      .append('rect')
      .attr('x', 0)
      .attr('y', -8)
      .attr('width', swatchW)
      .attr('height', swatchW)
      .attr('rx', 3)
      .attr('fill', (d) => color(d.key) as string)
      .attr('opacity', 0.95)

    legendRow
      .append('text')
      .attr('x', swatchW + swatchGap)
      .attr('y', 0)
      .attr('fill', '#A7A7A7')
      .style('font-size', isNarrow ? '11px' : '12px')
      .style('font-weight', 700)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))')
      .text((d) => d.label)

    const area = d3
      .area<d3.SeriesPoint<YearAgg>>()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5))

    // visual enhancement
    const defs = svg.append('defs')
    ;(seriesKeys as unknown as string[]).forEach((k) => {
      const id = `layer-grad-${k}`
      const c = color(k) as string

      const grad = defs
        .append('linearGradient')
        .attr('id', id)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')

      grad.append('stop').attr('offset', '0%').attr('stop-color', c).attr('stop-opacity', 0.80)
      grad.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', 0.3)
    })

    const layers = g
      .append('g')
      .selectAll('path')
      .data(stacked)
      .join('path')
      .attr('d', area)
      .attr('fill', (d) => `url(#layer-grad-${d.key})`)
      .attr('stroke', (d) => color(d.key) as string)
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.55)
      .style('filter', 'drop-shadow(0 0 8px rgba(29,185,84,0.18))')

    layers.append('title').text((d) => labelByKey[d.key] ?? d.key)


    const showInnerLabels = !isNarrow && innerW > 720 && innerH > 260
    if (!showInnerLabels) return

    const labelPos = stacked
      .map((layer) => {
        const isDuration = layer.key === 'duration_min'
        const last = layer[layer.length - 1]
        const xPos = innerW - 8
        const yPos = y((last[0] + last[1]) / 2) + (isDuration ? -20 : 0)
        return { key: layer.key, x: xPos, y: yPos, anchor: 'end' }
      })
      .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))

    g.append('g')
      .selectAll('text')
      .data(labelPos)
      .join('text')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('text-anchor', (d: any) => d.anchor)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 700)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))')
      .attr('fill', '#EDEDED')
      .text((d) => labelByKey[d.key] ?? d.key)
  }

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="stream-svg" width="100%" height="100%" />
    </div>
  )
}
