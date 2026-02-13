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
        // hw2 feedback fix: reduce green overuse
        border: '1px solid rgba(255,255,255,0.12)',
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
