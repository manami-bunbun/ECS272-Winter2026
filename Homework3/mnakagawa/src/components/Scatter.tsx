import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'
import type { ComponentSize, Margin, SpotifyTrack } from '../types'

type Props = {
  data: SpotifyTrack[]
}

type TooltipState = {
  x: number
  y: number
  d: SpotifyTrack
}

const formatFollowers = (v: number) => d3.format('.2s')(Math.max(0, v))

export default function Scatter({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointsRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const xAxisRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const yAxisRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null)
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null)

  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 34, right: 18, bottom: 58, left: 60 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize })

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // scales
  const x = useMemo(() => d3.scaleLinear().domain([0, 100]), [])
  const y = useMemo(() => d3.scaleLinear().domain([0, 100]), [])
  const pointR = 3.2
  // const pointR = 4

  useEffect(() => {
    if (!svgRef.current) return
    if (size.width === 0 || size.height === 0) return

    // axes + layout
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = size.width
    const h = size.height
    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)
    const plotSize = Math.min(innerW, innerH)
    const offsetX = (innerW - plotSize) / 2
    const offsetY = (innerH - plotSize) / 2

    x.range([0, plotSize])
    y.range([plotSize, 0])
    xScaleRef.current = x
    yScaleRef.current = y

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
    const plotG = g.append('g').attr('transform', `translate(${offsetX},${offsetY})`)

    xAxisRef.current = g
      .append('g')
      .attr('transform', `translate(${offsetX},${offsetY + plotSize})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d') as unknown as (n: number) => string))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    yAxisRef.current = g
      .append('g')
      .attr('transform', `translate(${offsetX},${offsetY})`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d') as unknown as (n: number) => string))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    g.append('text')
      .attr('x', offsetX + plotSize / 2)
      .attr('y', offsetY + plotSize + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Artist popularity')

    g.append('text')
      .attr('transform', `translate(${-18}, ${offsetY + plotSize / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Track popularity')

    pointsRef.current = plotG.append('g').attr('class', 'points')
  }, [margin.bottom, margin.left, margin.right, margin.top, size.height, size.width, x, y])

  useEffect(() => {
    if (!pointsRef.current) return
    if (size.width === 0 || size.height === 0) return

    // dots + tooltip
    const points = pointsRef.current
    const dotColor = () => '#1DB954'
    // const dotColor = (d: SpotifyTrack) => (d.explicit ? '#e63946' : '#1DB954')

    const t = d3.transition().duration(550).ease(d3.easeCubicInOut)

    const xs = xScaleRef.current ?? x
    const ys = yScaleRef.current ?? y

    const join = points.selectAll<SVGCircleElement, SpotifyTrack>('circle').data(data, (d) => d.track_id)

    join
      .exit()
      .transition(t)
      .attr('opacity', 0)
      .remove()

    const entered = join
      .enter()
      .append('circle')
      .attr('cx', (d) => xs(d.artist_popularity))
      .attr('cy', (d) => ys(d.track_popularity))
      .attr('r', 0)
      .attr('fill', dotColor)
      .attr('opacity', 0)
      .style('cursor', 'pointer')

    const merged = entered.merge(join as any)

    merged
      .on('mouseenter', function (event, d) {
        const [mx, my] = d3.pointer(event, chartRef.current)
        setTooltip({ x: mx, y: my, d })
        points
          .selectAll<SVGCircleElement, SpotifyTrack>('circle')
          .attr('opacity', (p) => (p.track_id === d.track_id ? 1 : 0.25))
          .attr('r', (p) => (p.track_id === d.track_id ? pointR * 1.9 : pointR))
        d3.select(this).attr('stroke', '#FFFFFF').attr('stroke-width', 1.25).raise()
      })
      .on('mousemove', function (event, d) {
        const [mx, my] = d3.pointer(event, chartRef.current)
        setTooltip({ x: mx, y: my, d })
      })
      .on('mouseleave', function () {
        setTooltip(null)
        points
          .selectAll<SVGCircleElement, SpotifyTrack>('circle')
          .attr('opacity', 0.9)
          .attr('stroke', 'none')
          .attr('r', pointR)
      })

    merged
      .transition(t)
      .attr('cx', (d) => xs(d.artist_popularity))
      .attr('cy', (d) => ys(d.track_popularity))
      .attr('r', pointR)
      .attr('fill', dotColor)
      .attr('opacity', 0.9)
  }, [data, pointR, size.height, size.width, x, y])

  return (
    <div ref={chartRef} className="chart-container chart-tooltip-root">
      <svg ref={svgRef} width="100%" height="100%" />
      {tooltip ? (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(tooltip.x + 12, Math.max(0, size.width - 260)),
            top: Math.max(8, tooltip.y - 12),
          }}
        >
          {/* <div className="chart-tooltip-row">id: {tooltip.d.track_id}</div> */}
          <div className="chart-tooltip-title">{tooltip.d.track_name}</div>
          <div className="chart-tooltip-sub">{tooltip.d.artist_name}</div>
          <div className="chart-tooltip-row">
            Track popularity: <span>{Math.round(tooltip.d.track_popularity)}</span>
          </div>
          <div className="chart-tooltip-row">
            Artist popularity: <span>{Math.round(tooltip.d.artist_popularity)}</span>
          </div>
          <div className="chart-tooltip-row">
            Followers: <span>{formatFollowers(tooltip.d.artist_followers)}</span>
          </div>
          <div className="chart-tooltip-row">
            Explicit: <span>{tooltip.d.explicit ? 'true' : 'false'}</span>
          </div>
          {tooltip.d.release_year ? (
            <div className="chart-tooltip-row">
              Year: <span>{tooltip.d.release_year}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
