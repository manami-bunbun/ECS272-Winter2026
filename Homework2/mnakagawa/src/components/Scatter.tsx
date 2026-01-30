import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'
import csvUrl from '../../data/spotify_data_clean.csv?url'
import { ComponentSize, Margin } from '../types'

type Row = {
  artist_name: string
  track_name: string
  artist_popularity: number
  track_popularity: number
  artist_followers: number
  album_release_date: string
}

//nan -> !0
const parseNumber = (v: unknown) => {
  if (v === null || v === undefined) return NaN
  const s = String(v).trim()
  if (s === '') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export default function Scatter() {

  const [rows, setRows] = useState<Row[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 50, right: 20, bottom: 80, left: 60 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  
  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })



  useEffect(() => {
    const load = async () => {
      try {
        const csvData = await d3.csv(csvUrl, (d) => ({
          artist_name: (d.artist_name ?? '').toString(),
          track_name: (d.track_name ?? '').toString(),
          artist_popularity: parseNumber(d.artist_popularity),
          track_popularity: parseNumber(d.track_popularity),
          artist_followers: parseNumber(d.artist_followers),
          album_release_date: (d.album_release_date ?? '').toString(),
        }))

        const cleaned = csvData
          .filter((d) => Number.isFinite(d.artist_popularity) && Number.isFinite(d.track_popularity))
          .filter((d) => d.artist_popularity >= 0 && d.track_popularity >= 0)

        setRows(cleaned)
      } catch (e) {
        console.error('Error loading CSV:', e)
      }
    }
    load();
  }, [])

  useEffect(() => {
    if (isEmpty(rows)) return
    if (size.width === 0 || size.height === 0) return
    d3.select('#scatter-svg').selectAll('*').remove()
    initChart()
  }, [rows, size])

  function initChart() {
    const svg = d3.select('#scatter-svg')

    const w = size.width
    const h = size.height

    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW])
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // x-axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d') as unknown as (n: number) => string))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    // y-axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d') as unknown as (n: number) => string))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    // plot
    const followersExtent = d3.extent(rows, (d) => d.artist_followers) as [number, number]
    const minFollowers = Math.max(1, followersExtent[0] ?? 1)
    const maxFollowers = Math.max(minFollowers, followersExtent[1] ?? minFollowers)
    const followersNorm = d3.scaleLog().domain([minFollowers, maxFollowers]).range([0, 1]).clamp(true)

    const defs = svg.append('defs')
    const gradId = 'followers-ylgn-grad'
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%')

    d3.range(0, 1.0001, 0.1).forEach((t) => {
      grad.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', d3.interpolateYlGn(t))
    })

    const legendW = 140
    const legendH = 8
    const legendX = Math.min(innerW - legendW + 10, innerW - legendW + margin.right - 2)
    const legendY = -margin.top + 7
    const legendScale = d3.scaleLog().domain([minFollowers, maxFollowers]).range([0, legendW]).clamp(true)

    const legend = g.append('g').attr('transform', `translate(${legendX},${legendY})`)

    legend
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('fill', '#A7A7A7')
      .style('font-size', '10px')
      .style('font-weight', 700)
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text('Followers')

    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 5)
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('rx', 3)
      .attr('fill', `url(#${gradId})`)
      .attr('stroke', '#2A2A2A')

    legend
      .append('g')
      .attr('transform', `translate(0, ${legendH + 14})`)
      .call(d3.axisBottom(legendScale).ticks(3).tickFormat(d3.format('.2s') as unknown as (n: number) => string))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))



    const pointR = 2

    g.append('g')
      .selectAll('circle')
      .data(rows)
      .join('circle')
      .attr('cx', (d) => x(d.artist_popularity))
      .attr('cy', (d) => y(d.track_popularity))
      .attr('r', pointR)
    //   .attr('fill', '#1DB954')
      .attr('fill', (d) => d3.interpolateYlGn(followersNorm(Math.max(1, d.artist_followers))))
      .attr('fill-opacity', 0.9)
    //   .attr('stroke', '#1ED760')
    //   .attr('stroke-opacity', 0.2)
      .append('title')
      .text(
        (d) =>
          `${d.artist_name}\n${d.track_name}\nartist_popularity: ${d.artist_popularity}\ntrack_popularity: ${d.track_popularity}`,
      )

    legend.raise()

    // axis labels
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Artist Popularity')

    g.append('text')
      .attr('transform', `translate(${-44}, ${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Track Popularity')
  }

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="scatter-svg" width="100%" height="100%" />
    </div>
  )
}
