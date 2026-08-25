import { useEffect, useState } from 'react'

import { p1Client } from '../api/p1Client'

export interface SkuRef {
  id: string
  skuCode: string
  name: string
  category: string
}

export interface DcRef {
  id: string
  dcCode: string
  name: string
  region: string
}

export interface ReferenceData {
  skus: SkuRef[]
  dcs: DcRef[]
  skuById: Map<string, SkuRef>
  dcById: Map<string, DcRef>
  loading: boolean
  error: boolean
}

/**
 * Loads the SKU and distribution-center catalogs once and exposes
 * id → record lookup maps. Every planner view that renders inventory,
 * expiry, or recommendation rows needs to turn a bare skuId/dcId into
 * a readable code, so this is shared rather than refetched per view.
 */
export function useReferenceData(): ReferenceData {
  const [skus, setSkus] = useState<SkuRef[]>([])
  const [dcs, setDcs] = useState<DcRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      p1Client.get<{ data: SkuRef[] }>('/skus'),
      p1Client.get<{ data: DcRef[] }>('/distribution-centers'),
    ])
      .then(([skuRes, dcRes]) => {
        if (cancelled) return
        setSkus(Array.isArray(skuRes.data?.data) ? skuRes.data.data : [])
        setDcs(Array.isArray(dcRes.data?.data) ? dcRes.data.data : [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    skus,
    dcs,
    skuById: new Map(skus.map((sku) => [sku.id, sku])),
    dcById: new Map(dcs.map((dc) => [dc.id, dc])),
    loading,
    error,
  }
}
