import { AppErrorBoundary } from './components/AppErrorBoundary'
import { Workbench } from './home/Workbench'
import { ThemeProvider } from './theme/theme'
import './styles/workbench.css'

function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <Workbench />
      </ThemeProvider>
    </AppErrorBoundary>
  )
}

export default App
