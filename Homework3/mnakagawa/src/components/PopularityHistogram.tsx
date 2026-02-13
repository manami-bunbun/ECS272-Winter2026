import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'
import type { ComponentSize, Margin, SpotifyTrack } from '../types'

type Props = {
  data: SpotifyTrack[]
  onRangeChange?: (domain: [number, number]) => void
  onRangeCommit?: (domain: [number, number]) => void
  onUserInteract?: () => void
  binWidth?: number
}

export default function PopularityHistogram({
  data,
  onRangeChange,
  onRangeCommit,
  onUserInteract,
  binWidth = 1,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const xOriginalRef = useRef<d3.ScaleLinear<number, number> | null>(null)
  const xAxisRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const yAxisRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const barsRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGRectElement, unknown> | null>(null)
  const lastTransformRef = useRef<d3.ZoomTransform | null>(null)
  const isRestoringRef = useRef(false)
  const hasInteractedRef = useRef(false)

  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  useResizeObserver({ ref: rootRef as React.RefObject<HTMLDivElement>, onResize })

  const margin: Margin = { top: 24, right: 18, bottom: 56, left: 54 }
  // const margin: Margin = { top: 18, right: 14, bottom: 46, left: 46 }

  const values = useMemo(() => data.map((d) => d.release_year ?? NaN).filter(Number.isFinite), [data])

  const bins = useMemo(() => {
    // bin years
    const extent = d3.extent(values) as [number, number]
    const minYear = Math.floor(extent[0] ?? 2000)
    const maxYear = Math.ceil(extent[1] ?? minYear)
    if (!Number.isFinite(minYear) || !Number.isFinite(maxYear) || minYear >= maxYear) return []
    const width = Math.max(1, Math.round(binWidth))
    // const width = 1
    const thresholds = d3.range(minYear, maxYear + 1 + width, width)
    return d3.bin().domain([minYear, maxYear + 1]).thresholds(thresholds)(values)
  }, [values, binWidth])

  useEffect(() => {
    if (!svgRef.current) return
    if (size.width === 0 || size.height === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = size.width
    const h = size.height
       // const innerW = w - margin.left - margin.right
    const innerW = Math.max(0, w - margin.left - margin.right)
    const innerH = Math.max(0, h - margin.top - margin.bottom)
    // const innerH = h - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
    const clipId = 'popularity-hist-clip'
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', clipId)
      .attr('clipPathUnits', 'userSpaceOnUse')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', innerH)

    const yearExtent = d3.extent(values) as [number, number]
    const minYear = Math.floor(yearExtent[0] ?? 2000)
    const maxYear = Math.ceil(yearExtent[1] ?? minYear + 1)
    
    const maxEdge = maxYear + 1
  
    const width = Math.max(1, Math.round(binWidth))


    const xOriginal = d3.scaleLinear().domain([minYear, maxEdge]).range([0, innerW]).nice()
    xOriginalRef.current = xOriginal

    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) ?? 1]).nice().range([innerH, 0])

    const makeYearTicks = (domain: [number, number]) => {
      const step = Math.max(1, Math.round(d3.tickStep(domain[0], domain[1], 10)))
      const start = Math.ceil(domain[0] / step) * step
      const end = Math.floor(domain[1] / step) * step
      return d3.range(start, end + 0.0001, step)
    }

    xAxisRef.current = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xOriginal)
          .tickValues(makeYearTicks(xOriginal.domain() as [number, number]))
          .tickFormat(d3.format('d') as unknown as (n: number) => string),
      )
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))
    // xAxisRef.current?.call(d3.axisBottom(xOriginal).ticks(6))

    yAxisRef.current = g
      .append('g')
      .call(d3.axisLeft(y).ticks(5))
      .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
      .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Release year')

    g.append('text')
      .attr('transform', `translate(${-44}, ${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5c5c5')
      .style('font-size', '12px')
      .text('Track count')

    // draw bars (clipped group)
    const clipGroup = g.append('g').attr('clip-path', `url(#${clipId})`)
    barsRef.current = clipGroup.append('g')

    const updateBars = (nextBins: d3.Bin<number, number>[]) => {
      const maxCount = d3.max(nextBins, (b) => b.length) ?? 1
      y.domain([0, maxCount]).nice()
      yAxisRef.current
        ?.call(d3.axisLeft(y).ticks(5))
        .call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
        .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))

      const join = barsRef.current
        ?.selectAll<SVGRectElement, d3.Bin<number, number>>('rect')
        .data(nextBins, (d: any) => d.x0)

      join
        ?.join(
          (enter) =>
            enter
              .append('rect')
              .attr('x', (d) => xOriginal(d.x0 ?? 0))
              .attr('y', (d) => y(d.length))
              .attr('width', (d) => Math.max(0, xOriginal(d.x1 ?? 0) - xOriginal(d.x0 ?? 0) - 1))
              .attr('height', (d) => innerH - y(d.length))
              .attr('fill', '#7FA6FF')
              .attr('fill-opacity', 0.85),
              // .attr('fill', '#1DB954')
          (update) =>
            update
              .attr('x', (d) => xOriginal(d.x0 ?? 0))
              .attr('y', (d) => y(d.length))
              .attr('width', (d) => Math.max(0, xOriginal(d.x1 ?? 0) - xOriginal(d.x0 ?? 0) - 1))
              .attr('height', (d) => innerH - y(d.length)),
          (exit) => exit.remove(),
        )

      barsRef.current?.selectAll<SVGTitleElement, d3.Bin<number, number>>('title').remove()
      barsRef.current
        ?.selectAll<SVGRectElement, d3.Bin<number, number>>('rect')
        .append('title')
        .text((d) => `Year ${d.x0}–${(d.x1 ?? 0) - 1}\nCount: ${d.length}`)
    }

    updateBars(bins)

    const clampDomain = (domain: [number, number]): [number, number] => {
      const a = Math.max(minYear, Math.min(maxEdge, domain[0]))
      const b = Math.max(minYear, Math.min(maxEdge, domain[1]))
      return a <= b ? [a, b] : [b, a]
    }

    const toYearRange = (domain: [number, number]) => {
      const a = Math.max(minYear, Math.floor(domain[0]))
      const b = Math.min(maxYear, Math.ceil(domain[1]) - 1)
      return a <= b ? ([a, b] as [number, number]) : ([a, a] as [number, number])
    }

    // zoom + rebin
    const zoomed = (event: d3.D3ZoomEvent<SVGRectElement, unknown>, isFinal: boolean) => {
      const x0 = xOriginalRef.current
      if (!x0) return
      lastTransformRef.current = event.transform
    
      const xZ = event.transform.rescaleX(x0)
      const domain = clampDomain(xZ.domain() as [number, number])
      const yearRange = toYearRange(domain)


      barsRef.current?.attr('transform', `translate(${event.transform.x},0) scale(${event.transform.k},1)`)

      if (isFinal) {
        xAxisRef.current?.call(
          d3
            .axisBottom(xZ)
            .tickValues(makeYearTicks(xZ.domain() as [number, number]))
            .tickFormat(d3.format('d') as unknown as (n: number) => string),
        )
        xAxisRef.current
          ?.call((gg) => gg.selectAll('text').attr('fill', '#A7A7A7'))
          .call((gg) => gg.selectAll('path,line').attr('stroke', '#2A2A2A'))
        const viewMin = Math.max(minYear, Math.floor(domain[0]))
        const viewMax = Math.min(maxYear, Math.ceil(domain[1]) - 1)
        const filteredVals = values.filter((v) => v >= viewMin && v <= viewMax)
        const thresholds = d3.range(minYear, maxYear + 1 + width, width)
        const nextBins = d3.bin().domain([minYear, maxYear + 1]).thresholds(thresholds)(filteredVals)

        updateBars(nextBins)

        if (isRestoringRef.current) {
          isRestoringRef.current = false
        } else {
          onRangeChange?.(yearRange)
          onRangeCommit?.(yearRange)
          // onRangeChange?.(yearRange)
        }
      }
    }

    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .scaleExtent([1, 15])
      .translateExtent([
        [0, 0],
        [innerW, innerH],
      ])
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on('start', (event) => {
        if (event.sourceEvent && !hasInteractedRef.current) {
          hasInteractedRef.current = true
          onUserInteract?.()
        }
      })
      .on('zoom', (event) => zoomed(event, false))
      .on('end', (event) => zoomed(event, true))
    zoomRef.current = zoom

    const zoomRect = g
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'grab')
      .call(zoom as any)

    const initial: [number, number] = [minYear, maxYear]
    if (lastTransformRef.current) {
      isRestoringRef.current = true
      zoomRect.call(zoom.transform as any, lastTransformRef.current)
    } else {
      onRangeChange?.(initial)
      onRangeCommit?.(initial)
    }

    return () => {}
  }, [
    bins,
    size.width,
    size.height,
  
    margin.bottom,
    margin.left,
    margin.right,
    margin.top,
    onRangeChange,
    onRangeCommit,
    onUserInteract,
  ])

  return (
    <div ref={rootRef} className="chart-container">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
