import { useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { Profile, UserRole } from '@/integrations/supabase/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    session: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    const [{ data: profile }, { data: roleData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
    ])
    return { profile, role: roleData?.role ?? 'passenger' }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { profile, role } = await fetchProfile(session.user.id)
        setState({ user: session.user, profile, role, session, loading: false })
      } else {
        setState(s => ({ ...s, loading: false }))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { profile, role } = await fetchProfile(session.user.id)
          setState({ user: session.user, profile, role, session, loading: false })
        } else {
          setState({ user: null, profile: null, role: null, session: null, loading: false })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signInWithPhone = async (phone: string) => {
    const formatted = phone.startsWith('+') ? phone : `+237${phone.replace(/^0/, '')}`
    return supabase.auth.signInWithOtp({ phone: formatted })
  }

  const verifyOtp = async (phone: string, token: string) => {
    const formatted = phone.startsWith('+') ? phone : `+237${phone.replace(/^0/, '')}`
    return supabase.auth.verifyOtp({ phone: formatted, token, type: 'sms' })
  }

  const signInWithEmail = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!state.user) return
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id)
      .select()
      .single()
    if (!error && data) {
      setState(s => ({ ...s, profile: data }))
    }
    return { data, error }
  }

  return {
    ...state,
    isPassenger: state.role === 'passenger',
    isDriver: state.role === 'driver',
    isAdmin: state.role === 'admin',
    signInWithPhone,
    verifyOtp,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
  }
}
