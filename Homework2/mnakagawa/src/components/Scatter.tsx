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

export default function Scatter() {

  const [rows, setRows] = useState<Row[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 40, right: 20, bottom: 80, left: 60 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  
  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })



  useEffect(() => {
    const load = async () => {
      try {
        const csvData = await d3.csv(csvUrl, (d) => ({
          artist_name: (d.artist_name ?? '').toString(),
          track_name: (d.track_name ?? '').toString(),
          artist_popularity: +(d.artist_popularity ?? 0),
          track_popularity: +(d.track_popularity ?? 0),
          artist_followers: +(d.artist_followers ?? 0),
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
    const pointR = 2

    g.append('g')
      .selectAll('circle')
      .data(rows)
      .join('circle')
      .attr('cx', (d) => x(d.artist_popularity))
      .attr('cy', (d) => y(d.track_popularity))
      .attr('r', pointR)
      .attr('fill', '#1DB954')
      .attr('fill-opacity', 0.55)
      .attr('stroke', '#1ED760')
      .attr('stroke-opacity', 0.35)
      .append('title')
      .text(
        (d) =>
          `${d.artist_name}\n${d.track_name}\nartist_popularity: ${d.artist_popularity}\ntrack_popularity: ${d.track_popularity}`,
      )

    // axis labels
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text('Artist Popularity')

    g.append('text')
      .attr('transform', `translate(${-44}, ${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text('Track Popularity')
  }

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="scatter-svg" width="100%" height="100%" />
    </div>
  )
}
