import Panel from './components/Panel'
import Scatter from './components/Scatter'
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useCallback, useEffect, useMemo, useState } from 'react'
import PopularityHistogram from './components/PopularityHistogram'
import RadarComparison from './components/RadarComparison'
import { loadSpotifyTracks } from './loadSpotify'
import type { SpotifyTrack } from './types'

import csvPastUrl from '../data/track_data_final.csv?url'
import csv2025Url from '../data/spotify_data_clean.csv?url'


const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:{
      main: '#1DB954',   // Spotify green
    },
    secondary:{
      main: '#1ED760',
    },
    background: {
      default: '#0B0B0F', 
      paper: '#121218', 
    },
    text: {
      primary: '#EDEDED',
      secondary: '#A7A7A7',
    },
  },
})



function Layout() {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [domainPreview, setDomainPreview] = useState<[number, number]>([0, 0])
  const [domain, setDomain] = useState<[number, number]>([0, 0])
  const [hasInitDomain, setHasInitDomain] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showZoomHint, setShowZoomHint] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const all = await loadSpotifyTracks([csvPastUrl, csv2025Url])
        setTracks(all)
        // console.log('loaded rows', all.length)
      } catch (e) {
        console.error('Failed to load Spotify CSVs:', e)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (hasInitDomain) return
    if (tracks.length === 0) return
    const years = tracks.map((d) => d.release_year ?? NaN).filter(Number.isFinite)
    if (years.length === 0) return
    const minYear = Math.floor(Math.min(...years))
    const maxYear = Math.ceil(Math.max(...years))
    setDomain([minYear, maxYear])
    setDomainPreview([minYear, maxYear])
    setHasInitDomain(true)
  }, [hasInitDomain, tracks])

  const filtered = useMemo(() => {
    const a = Math.min(domain[0], domain[1])
    const b = Math.max(domain[0], domain[1])
    return tracks.filter((d) => d.release_year !== undefined && d.release_year >= a && d.release_year <= b)
  }, [domain, tracks])

  const displayDomain = useMemo(() => {
    const a = Math.round(Math.min(domainPreview[0], domainPreview[1]))
    const b = Math.round(Math.max(domainPreview[0], domainPreview[1]))
    return [a, b] as [number, number]
  }, [domainPreview])

  const handleRangeChange = useCallback((d: [number, number]) => {
    setDomainPreview(d)
  }, [])

  const handleRangeCommit = useCallback(
    (d: [number, number]) => {
      setDomainPreview(d)
      const same = Math.abs(d[0] - domain[0]) < 0.001 && Math.abs(d[1] - domain[1]) < 0.001
      if (same) return
      setIsUpdating(true)
      requestAnimationFrame(() => setDomain(d))
      window.setTimeout(() => setIsUpdating(false), 650)
    },
    [domain],
  )

  const handleZoomInteract = useCallback(() => {
    setShowZoomHint(false)
  }, [])

  return (
    <Box id='main-container'>
      <Stack spacing={1} sx={{ height: '100%' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: '#A7A7A7', fontWeight: 800 }}>
            see design.md for detail
          </Typography>
        </Box>
        <Grid container spacing={1} sx={{ height: '42%' }}>
          <Grid size={12}>
            <Panel title="Hits Track Counts by Release Years">
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="caption" sx={{ color: '#A7A7A7', fontWeight: 800 }}>
                  </Typography>
                  <Box
                    sx={{
                      px: 1.2,
                      py: 0.35,
                      borderRadius: 999,
                      bgcolor: 'rgba(29,185,84,0.15)',
                      border: '1px solid rgba(29,185,84,0.35)',
                      color: '#B8F3CF',
                      fontSize: '11px',
                      fontWeight: 900,
                      letterSpacing: '0.02em',
                    }}
                  >
                    Scroll = zoom 🔍 / Drag = pan ↔️
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: '#A7A7A7', fontWeight: 800, display: 'block', mb: 0.75 }}>
                  Selected year range: {displayDomain[0]}–{displayDomain[1]} <br></br> Filter by year
                  {' · '}N= {filtered.length.toLocaleString()} / {tracks.length.toLocaleString()} tracks
                </Typography>
                {/* <Typography variant="caption" sx={{ color: '#6f6f6f', display: 'block', mb: 0.75 }}>
                  debug: {domainPreview[0].toFixed(2)} - {domainPreview[1].toFixed(2)}
                </Typography> */}
                <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <PopularityHistogram
                    data={tracks}
                    onRangeChange={handleRangeChange}
                    onRangeCommit={handleRangeCommit}
                    onUserInteract={handleZoomInteract}
                  />
                  {showZoomHint ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.55)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          px: 2.2,
                          py: 1,
                          borderRadius: 999,
                          bgcolor: 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#EDEDED',
                          fontSize: '13px',
                          fontWeight: 900,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Scroll = zoom 🔍 / Drag = pan ↔️
                      </Box>
                    </Box>
                  ) : null}
                  {/* placeholder for custom tooltip layer
                  <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                  */}
                </Box>
              </Box>
            </Panel>
          </Grid>
        </Grid>
        <Grid container spacing={1} sx={{ height: '58%' }}>
          <Grid size={6}>
            <Box sx={{ position: 'relative', height: '100%' }}>
              <Panel title="Selected Years vs Overall Popular Track Trend">
                <Box sx={{ position: 'relative', height: '100%' }}>
                  <RadarComparison baseline={tracks} filtered={filtered} />
                  {isUpdating ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 1,
                        bgcolor: 'rgba(18,18,24,0.55)',
                        borderRadius: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      <CircularProgress size={20} />
                      <Typography variant="caption" sx={{ color: '#EDEDED', fontWeight: 800 }}>
                        Updating…
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              </Panel>
              {showZoomHint ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    borderRadius: 2,
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                />
              ) : null}
            </Box>
          </Grid>
          <Grid size={6}>
            <Box sx={{ position: 'relative', height: '100%' }}>
              <Panel title="Realtionship Artist vs Track Popularity for Selected Year Range">
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ color: '#A7A7A7', fontWeight: 800 }}>
                    </Typography>
                    <Box
                      sx={{
                        px: 1.2,
                        py: 0.35,
                        borderRadius: 999,
                        bgcolor: 'rgba(29,185,84,0.15)',
                        border: '1px solid rgba(29,185,84,0.35)',
                        color: '#B8F3CF',
                        fontSize: '11px',
                        fontWeight: 900,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Hover to reveal track detail
                    </Box>
                  </Box>
                  <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
                    <Scatter data={filtered} />
                    {isUpdating ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: 1,
                          bgcolor: 'rgba(18,18,24,0.55)',
                          borderRadius: 2,
                          pointerEvents: 'none',
                        }}
                      >
                        <CircularProgress size={20} />
                        <Typography variant="caption" sx={{ color: '#EDEDED', fontWeight: 800 }}>
                          Updating…
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              </Panel>
              {showZoomHint ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    borderRadius: 2,
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                />
              ) : null}
            </Box>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout />
    </ThemeProvider>
  )
}

export default App
