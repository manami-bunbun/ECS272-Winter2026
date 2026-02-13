import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'
import type { ComponentSize, Margin, SpotifyTrack } from '../types'

type Props = {
  baseline: SpotifyTrack[]
  filtered: SpotifyTrack[]
}

type MetricKey = 'explicit' | 'artist_popularity' | 'artist_followers'

type Metric = {
  key: MetricKey
  label: string
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export default function RadarComparison({ baseline, filtered }: Props) {

  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)


  const layoutRef = useRef<{
    cx: number
    cy: number
    radius: d3.ScaleLinear<number, number>
    angle: d3.ScaleLinear<number, number>
    makePoints: (vals: Record<MetricKey, number>) => string
    extentText: (k: MetricKey) => string
    formatVal: (k: MetricKey, v: number) => string
  } | null>(null)

  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  useResizeObserver({ ref: rootRef as React.RefObject<HTMLDivElement>, onResize })

  const margin: Margin = { top: 18, right: 16, bottom: 16, left: 16 }

  const metrics: Metric[] = useMemo(
    () => [
      { key: 'explicit', label: 'Explicit (%)' },
      { key: 'artist_popularity', label: 'Artist Popularity' },
      { key: 'artist_followers', label: 'Artist Followers' },
    ],
    [],
  )

  // normalize baseline domain
  const normFor = useMemo(() => {
    const followerVals = baseline.map((d) => d.artist_followers ?? NaN).filter(Number.isFinite)
    const extent = d3.extent(followerVals) as [number, number]
    const minFollowers = extent[0] ?? 0
    const maxFollowers = extent[1] ?? minFollowers + 1
    const denom = maxFollowers - minFollowers || 1

    const norm = (key: MetricKey, v: number) => {
      if (!Number.isFinite(v)) return 0.5
      if (key === 'artist_popularity') return clamp01(v / 100)
      if (key === 'explicit') return clamp01(v)
      return clamp01((v - minFollowers) / denom)
    }

    return { norm, minFollowers, maxFollowers }
  }, [baseline])

  const agg = useMemo(() => {
    // aggregate summary stats
    const mean = (arr: SpotifyTrack[], f: (d: SpotifyTrack) => number) => d3.mean(arr, f) ?? 0
    const meanFinite = (arr: SpotifyTrack[], f: (d: SpotifyTrack) => number) => {
      const vals = arr.map(f).filter(Number.isFinite)
      return d3.mean(vals) ?? 0
    }

    const baselineAgg = {
      explicit: mean(baseline, (d) => (d.explicit ? 1 : 0)),
      artist_popularity: mean(baseline, (d) => d.artist_popularity),
      artist_followers: meanFinite(baseline, (d) => d.artist_followers ?? NaN),
    }

    const filteredAgg = {
      explicit: mean(filtered, (d) => (d.explicit ? 1 : 0)),
      artist_popularity: mean(filtered, (d) => d.artist_popularity),
      artist_followers: meanFinite(filtered, (d) => d.artist_followers ?? NaN),
    }

    return { baselineAgg, filteredAgg }
  }, [baseline, filtered])

  useEffect(() => {
    if (!svgRef.current) return
    if (size.width === 0 || size.height === 0) return

    const svg = d3.select(svgRef.current)
    const w = size.width
    const h = size.height
    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)

    const cx = margin.left + innerW / 2
    const cy = margin.top + innerH / 2
    const R = Math.min(innerW, innerH) / 2 - 28

    const angle = d3
      .scaleLinear()
      .domain([0, metrics.length])
      .range([-Math.PI / 2, -Math.PI / 2 + Math.PI * 2])

    const radius = d3.scaleLinear().domain([0, 1]).range([0, R])

    const makePoints = (vals: Record<MetricKey, number>) =>
      metrics
        .map((m, i) => {
          const a = angle(i)
          const vNorm = normFor.norm(m.key, vals[m.key])
          const rr = radius(vNorm)
          return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
        })
        .join(' ')

    const extentText = (k: MetricKey) => {
      if (k === 'explicit') return '0–100%'
      if (k === 'artist_popularity') return '0–100'
      return `${Math.round(normFor.minFollowers).toLocaleString()}–${Math.round(normFor.maxFollowers).toLocaleString()}`
    }

    const formatVal = (k: MetricKey, v: number) => {
      if (k === 'explicit') return `${Math.round(v * 100)}%`
      if (k === 'artist_followers') return d3.format('.2s')(v)
      return `${Math.round(v)}`
    }

    layoutRef.current = { cx, cy, radius, angle, makePoints, extentText, formatVal }

    // init layout + axes
    svg.selectAll('*').remove()

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
      .attr('x', (_, i) => cx + (radius(1) + 22) * Math.cos(angle(i)))
      .attr('y', (_, i) => cy + (radius(1) + 22) * Math.sin(angle(i)))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 800)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))')
      .each(function (d) {
        const sel = d3.select(this)
        const x0 = sel.attr('x')
        sel.selectAll('*').remove()

        sel.append('tspan').attr('x', x0).attr('dy', '0').attr('fill', '#A7A7A7').text(d.label)
        sel
          .append('tspan')
          .attr('x', x0)
          .attr('dy', '1.15em')
          .attr('fill', '#8F8F8F')
          .style('font-size', '10px')
          .style('font-weight', 800)
          .text(`Extent: ${extentText(d.key)}`)

        const allAvg = formatVal(d.key, agg.baselineAgg[d.key])
        const selAvg = formatVal(d.key, agg.filteredAgg[d.key])
        sel
          .append('tspan')
          .attr('x', x0)
          .attr('dy', '1.15em')
          .attr('fill', '#c1c1c1')
          .style('font-size', '10px')
          .style('font-weight', 800)
          .text(`Avg: all ${allAvg} | selected ${selAvg}`)
      })

    svg
      .append('polygon')
      .attr('class', 'baseline-poly')
      .attr('points', makePoints(agg.baselineAgg))
      .attr('fill', 'none')
      .attr('stroke', '#B0B0B0')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.95)
      .attr('stroke-dasharray', '6 4')

    svg
      .append('polygon')
      .attr('class', 'filtered-poly')
      .attr('points', makePoints(agg.filteredAgg))
      .attr('fill', '#FFB020')
      .attr('fill-opacity', 0.12)
      .attr('stroke', '#FFB020')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.9)

    const legend = svg.append('g').attr('transform', `translate(${margin.left + 8}, ${margin.top + 10})`)

    legend.append('circle').attr('cx', 6).attr('cy', 6).attr('r', 4).attr('fill', '#B0B0B0').attr('opacity', 0.85)
    legend
      .append('text')
      .attr('x', 16)
      .attr('y', 9)
      .attr('fill', '#c1c1c1')
      .style('font-size', '12px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text('All tracks (baseline)')

    legend.append('circle').attr('cx', 6).attr('cy', 26).attr('r', 4).attr('fill', '#FFB020').attr('opacity', 0.9)
    legend
      .append('text')
      .attr('x', 16)
      .attr('y', 29)
      .attr('fill', '#bebdbd')
      .style('font-size', '12px')
      .style('paint-order', 'stroke')
      .style('stroke', '#191414')
      .style('stroke-width', 3)
      .style('stroke-linejoin', 'round')
      .text('Selected range')

  }, [margin.bottom, margin.left, margin.right, margin.top, metrics, normFor, size.height, size.width])

  useEffect(() => {
    if (!svgRef.current) return
    const layout = layoutRef.current
    if (!layout) return

    const svg = d3.select(svgRef.current)
    const baselinePoly = svg.select<SVGPolygonElement>('polygon.baseline-poly')
    const filteredPoly = svg.select<SVGPolygonElement>('polygon.filtered-poly')
    if (baselinePoly.empty() || filteredPoly.empty()) return

    baselinePoly.attr('points', layout.makePoints(agg.baselineAgg))

  
    const nextPoints = layout.makePoints(agg.filteredAgg)
    const fadeOut = filteredPoly
      .transition()
      .duration(260)
      .ease(d3.easeCubicInOut)
      .attr('fill-opacity', 0)
      .attr('stroke-opacity', 0)

    fadeOut.on('end', function () {
      const sel = d3.select(this)
      sel.attr('points', nextPoints)
      sel
        .transition()
        .duration(320)
        .ease(d3.easeCubicInOut)
        .attr('fill-opacity', 0.1)
        .attr('stroke-opacity', 0.9)
    })

    svg.selectAll('text').each(function (d) {

      const dd = d as Metric | undefined
      if (!dd?.key) return
      const sel = d3.select(this)
      const tspans = sel.selectAll<SVGTSpanElement, unknown>('tspan')
      if (tspans.size() < 3) return
      const allAvg = layout.formatVal(dd.key, agg.baselineAgg[dd.key])
      const selAvg = layout.formatVal(dd.key, agg.filteredAgg[dd.key])
      const next = `Avg: all ${allAvg} | selected ${selAvg}`
      tspans.filter((_, i) => i === 2).transition().duration(420).ease(d3.easeCubicInOut).text(next)
    })

  }, [agg])

  return (
    <div ref={rootRef} className="chart-container">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
