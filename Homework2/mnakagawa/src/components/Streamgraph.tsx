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
          track_popularity: +(d.track_popularity ?? 0),
          artist_popularity: +(d.artist_popularity ?? 0),
          artist_followers: +(d.artist_followers ?? 0),
          track_duration_min: +(d.track_duration_ms ?? 0) / 60000, // ms -> min
          explicit: (d.explicit ?? '').toString(),
          album_release_date: (d.album_release_date ?? '').toString(),
        }))

        const csv2025Data = await d3.csv(csv2025Url, (d) => ({
          track_popularity: +(d.track_popularity ?? 0),
          artist_popularity: +(d.artist_popularity ?? 0),
          artist_followers: +(d.artist_followers ?? 0),
          track_duration_min: +(d.track_duration_min ?? 0), // もともとmin
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

    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)

    const labelByKey: Record<string, string> = {
      track_popularity: 'Track Popularity',
      artist_popularity: 'Artist Popularity',
      followers_log: 'Followers (log10)',
      duration_min: 'Duration (min)',
      explicit_rate: 'Explicit Rate',
    }

    const palette = ['#1DB954', '#1ED760', '#2F80ED', '#56CCF2', '#B0B0B0']
    const color = d3
      .scaleOrdinal<string>()
      .domain(seriesKeys as unknown as string[])
      .range(palette)


    // date
    const parseDate = d3.timeParse('%Y-%m-%d')
    const toDate = (s: string) => {
      const t = parseDate(String(s))
      return t ?? null
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

    const normAgg: YearAgg[] = agg.map((d) => ({
      year: d.year,
      track_popularity: norm('track_popularity', d.track_popularity),
      artist_popularity: norm('artist_popularity', d.artist_popularity),
      followers_log: norm('followers_log', d.followers_log),
      duration_min: norm('duration_min', d.duration_min),
      explicit_rate: norm('explicit_rate', d.explicit_rate),
    }))

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

    // y: stack
    const yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) ?? 1
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // x-axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(32).tickFormat(d3.format('d')))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))
      .call((gg) => gg.selectAll('text').attr('transform', 'rotate(-25)').style('text-anchor', 'end'))

    // y-axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
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

    const area = d3
      .area<d3.SeriesPoint<YearAgg>>()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5))

   
    //legend
    const legendX = Math.max(0, innerW - 210)
    const legend = g.append('g').attr('transform', `translate(${legendX}, 0)`)

    const legendRow = legend
      .selectAll('g')
      .data(seriesKeys as unknown as string[])
      .join('g')
      .attr('transform', (_, i) => `translate(0, ${i * 18})`)

    legendRow
      .append('rect')
      .attr('x', 0)
      .attr('y', -10)
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 3)
      .attr('fill', (k) => color(k) as string)

    legendRow
      .append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text((k) => labelByKey[k] ?? k)



    // title
    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 18)
      .attr('fill', '#EDEDED')
      .style('font-weight', 700)
      .style('font-size', '13px')
      .text('Hit Trends by Release-Year')
  }

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="stream-svg" width="100%" height="100%" />
    </div>
  )
}
