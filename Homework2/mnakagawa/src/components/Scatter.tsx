import React, { useMemo } from 'react'
import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { isEmpty } from 'lodash';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';
import csvUrl from '../../data/spotify_data_clean.csv?url'
import { Bar, ComponentSize, Margin } from '../types';


type Row = {
  artist_name: string
  track_name: string
  artist_popularity: number
  track_popularity: number
  artist_followers: number
  album_release_date: string
}

export default function Scatter() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // csv
  const [data, setData] = useState<Row[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const margin: Margin = { top: 40, right: 20, bottom: 80, left: 60 };
  

  const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200)
  useResizeObserver({ ref: wrapRef as React.RefObject<HTMLDivElement>, onResize })
  
  useEffect(() => {
    ;(async () => {
      const rows = await d3.csv(csvUrl, (d) => ({
        artist_name: (d.artist_name ?? '').toString(),
        track_name: (d.track_name ?? '').toString(),
        artist_popularity: +(d.artist_popularity ?? 0),
        track_popularity: +(d.track_popularity ?? 0),
        artist_followers: +(d.artist_followers ?? 0),
        album_release_date: (d.album_release_date ?? '').toString(),
      }))

      const cleaned = rows
        .filter((d) => Number.isFinite(d.artist_popularity) && Number.isFinite(d.track_popularity))
        .filter((d) => d.artist_popularity >= 0 && d.track_popularity >= 0)

      setData(cleaned)
    })().catch(console.error)
  }, [])


  useEffect(() => {
    if (!svgRef.current) return
    if (size.width === 0 || size.height === 0) return
    if (data.length === 0) return

    const svg = d3.select(svgRef.current)

    svg.selectAll('*').remove()

    const w = size.width
    const h = size.height

    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)

    // x-axis: artist_popularity
    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.artist_popularity) as [number, number])
      .nice()
      .range([0, innerW])

    // y-axis: track_popularity
    const y = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.track_popularity) as [number, number])
      .nice()
      .range([innerH, 0])

    // radius: followers
    const r = d3
      .scaleSqrt()
      .domain(d3.extent(data, (d) => d.artist_followers) as [number, number])
      .range([2, 10])

  
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // x-axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    // y-axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(6))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    // scatter
    g.append('g')
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(d.artist_popularity))
      .attr('cy', (d) => y(d.track_popularity))
      .attr('r', (d) => r(d.artist_followers || 0))
      .attr('fill', '#1DB954')
      .attr('fill-opacity', 0.55)
      .attr('stroke', '#1ED760')
      .attr('stroke-opacity', 0.35)
      .append('title')
      .text(
        (d) =>
          `${d.artist_name}\n${d.track_name}\nartist_popularity: ${d.artist_popularity}\ntrack_popularity: ${d.track_popularity}`,
      )

    // label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text('Artist Popularity')

    g.append('text')
      .attr('transform', `translate(${-40}, ${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#A7A7A7')
      .style('font-size', '12px')
      .text('Track Popularity')
  }, [data, size, margin])

  return (
    <div ref={wrapRef} style={{ height: '100%' }}>
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
