import Example from './components/Example'
import Notes from './components/Notes'
import Panel from './components/Panel'
import StarPlot from './components/StarPlot'
import Scatter from './components/Scatter'
import { NotesWithReducer, CountProvider } from './components/NotesWithReducer';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { grey } from '@mui/material/colors';
import Streamgraph from './components/Streamgraph'


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

// For how Grid works, refer to https://mui.com/material-ui/react-grid/

function Layout() {
  return (
    <Box id='main-container'>
      <Stack spacing={1} sx={{ height: '100%' }}>
        {/* Top row: Example component taking about 60% width */}
        <Grid container spacing={3} sx={{ height: '55%' }}>
          <Grid size={12}>
            <Panel title="Hit Trend By Release Year">
              <Streamgraph />
            </Panel>
          </Grid>
          {/* flexible spacer to take remaining space */}
          {/* <Grid size="grow" /> */}
        </Grid>
        {/* Bottom row: Notes component taking full width */}
        <Grid container spacing={1} sx={{ height: '45%' }}>
          <Grid size={5}>
            <Panel title="Trend Comparison : Past vs 2025">
              <StarPlot />
            </Panel>
          </Grid>
          <Grid size={7}>
            <Panel title="Relationship Track Popularity vs Artist Popularity">
              <Scatter />
            </Panel>
          </Grid>
          {/* <Notes msg={"This is a message sent from App.tsx as component prop"} />
          {
            // <CountProvider>
            //   <NotesWithReducer msg={"This is a message sent from App.tsx as component prop"} />
            // </CountProvider>
          } */}
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
