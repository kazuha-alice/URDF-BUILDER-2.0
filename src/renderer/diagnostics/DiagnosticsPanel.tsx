import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'

export function DiagnosticsPanel() {
  const diagnostics = useProjectStore((state) => state.diagnostics)

  if (!diagnostics.length) {
    return (
      <div className="diagnostics-panel empty-panel">
        <CheckCircle2 size={24} />
        <strong>URDF is valid for the current milestone parser.</strong>
        <span>No structural diagnostics are active.</span>
      </div>
    )
  }

  return (
    <div className="diagnostics-panel">
      {diagnostics.map((diagnostic) => (
        <div key={diagnostic.id} className={`diagnostic-card ${diagnostic.severity}`}>
          {diagnostic.severity === 'info' ? <Info size={16} /> : <AlertTriangle size={16} />}
          <div>
            <strong>{diagnostic.severity}</strong>
            <span>{diagnostic.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
