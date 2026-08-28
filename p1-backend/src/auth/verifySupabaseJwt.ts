import type { NextFunction, Request, Response } from 'express'

import { supabaseClient } from '../db/supabaseClient'

export type SupabaseUserRole = 'PLANNER' | 'PROCUREMENT_OFFICER' | 'ADMIN'

interface UserProfileRow {
  role: SupabaseUserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: SupabaseUserRole
      }
    }
  }
}

const bearerTokenFrom = (header: string | undefined): string | null => {
  if (!header) return null

  const [scheme, token, ...extra] = header.trim().split(/\s+/)
  if (scheme !== 'Bearer' || !token || extra.length > 0) return null

  return token
}

const unauthorized = (res: Response) => {
  res.status(401).json({ error: 'Invalid or missing Supabase session token' })
}

// Uses Supabase's server-side auth.getUser(token) verification path instead of
// local JWKS parsing. The existing service-role client verifies the JWT with
// Supabase Auth, then reads the shared public.users profile for the app role.
export const verifySupabaseJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = bearerTokenFrom(req.header('authorization'))
    if (!token) {
      unauthorized(res)
      return
    }

    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !authData.user) {
      console.warn('[auth] Supabase access-token verification failed:', authError?.message ?? 'No user returned')
      unauthorized(res)
      return
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle<UserProfileRow>()

    if (profileError || !profile?.role) {
      console.warn(
        '[auth] User profile lookup failed:',
        profileError?.message ?? `No role found for user ${authData.user.id}`,
      )
      unauthorized(res)
      return
    }

    req.user = {
      id: authData.user.id,
      role: profile.role,
    }

    next()
  } catch (error) {
    console.warn('[auth] Unexpected authentication failure:', error instanceof Error ? error.message : error)
    unauthorized(res)
  }
}
