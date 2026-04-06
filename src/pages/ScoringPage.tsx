import { Navigate, useParams } from 'react-router-dom'

/** Legacy route — judges score on the full project page. */
export function ScoringPage() {
  const { projectId } = useParams()
  if (!projectId) return <Navigate to="/judge/feed" replace />
  return <Navigate to={`/project/${projectId}`} replace />
}
