import { Terminal } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'

export function ConsolePanel() {
  const document = useProjectStore((state) => state.document)
  const robot = useProjectStore((state) => state.robot)

  return (
    <div className="console-panel">
      <div className="console-line">
        <Terminal size={14} />
        <span>URDF Builder console initialized.</span>
      </div>
      <div className="console-line">
        <span>document</span>
        <code>{document.fileName}</code>
      </div>
      <div className="console-line">
        <span>robot</span>
        <code>
          {robot.links.length} links / {robot.joints.length} joints / {robot.sensors.length} sensors
        </code>
      </div>
    </div>
  )
}
