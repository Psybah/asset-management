import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Empty, Page } from '../components/ui'
import { api } from '../lib/api'
import type { Asset } from '../lib/types'

/** Landing route for QR labels: /scan/AST-0001 → asset page. */
export default function Scan() {
  const { tag } = useParams()
  const [id, setId] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    api.get<Asset>(`/assets/by-tag/${encodeURIComponent(tag ?? '')}/`).then((a) => setId(a.id)).catch(() => setMissing(true))
  }, [tag])
  if (id) return <Navigate to={`/assets/${id}`} replace />
  return <Page>{missing ? <Empty>{tag} not found</Empty> : <div className="h-64 animate-pulse rounded-[2.5rem] bg-mist" />}</Page>
}
