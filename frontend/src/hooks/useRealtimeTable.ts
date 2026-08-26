import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { supabaseClient } from '../lib/supabaseClient'

type RealtimeChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

export function useRealtimeTable(
  schema: string,
  table: string,
  onChange: (payload: RealtimeChangePayload) => void,
) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const client = supabaseClient

    if (!client) {
      return
    }

    const channel = client
      .channel(`realtime:${schema}:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema, table },
        (payload) => onChangeRef.current(payload),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[useRealtimeTable] Failed to subscribe to ${schema}.${table}`)
        }
      })

    return () => {
      void client.removeChannel(channel)
    }
  }, [schema, table])
}

export type { RealtimeChangePayload }
