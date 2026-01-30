import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

type PanelProps = {
  title?: string
  children: React.ReactNode
}

export default function Panel({ title, children }: PanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        p: 2,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid rgba(29,185,84,0.18)',
      }}
    >
      {title ? (
        <Typography variant="subtitle2" sx={{ color: '#FFFFFF', mb: 1, fontWeight: 800 }}>
          {title}
        </Typography>
      ) : null}
      {children}
    </Paper>
  )
}
