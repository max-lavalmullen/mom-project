import { useState, useEffect, createContext, useContext } from 'react'
import {
  supabase,
  isSupabaseConfigured,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signInWithGoogle as supabaseSignInWithGoogle,
  signOut as supabaseSignOut,
  getUserPlatforms,
  setUserPlatforms,
  getUserGenres,
  setUserGenres,
  getUserWatchlist,
  addToWatchlist as supabaseAddToWatchlist,
  updateWatchlistItem,
  removeFromWatchlist as supabaseRemoveFromWatchlist,
  getUserEloScores,
  checkNeedsOnboarding,
  getUserPreferenceProfile,
} from '../services/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userPreferences, setUserPreferences] = useState({
    platforms: [],
    genres: [],
  })
  const [watchlist, setWatchlist] = useState([])
  const [allEloScores, setAllEloScores] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState(null)
  const [preferenceProfile, setPreferenceProfile] = useState(null)

  // Initialize auth state
  useEffect(() => {
    // If Supabase isn't configured, just set loading to false
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
        loadOnboardingStatus(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          loadUserData(session.user.id)
          loadOnboardingStatus(session.user.id)
        } else {
          setUserPreferences({ platforms: [], genres: [] })
          setWatchlist([])
          setAllEloScores([])
          setOnboardingStatus(null)
          setPreferenceProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Load user data (platforms, genres, watchlist, Elo scores)
  const loadUserData = async (userId) => {
    if (!isSupabaseConfigured()) return

    try {
      const [platformsRes, genresRes, watchlistRes, eloRes, profileRes] = await Promise.all([
        getUserPlatforms(userId),
        getUserGenres(userId),
        getUserWatchlist(userId),
        getUserEloScores(userId),
        getUserPreferenceProfile(userId),
      ])

      setUserPreferences({
        platforms: platformsRes.data?.map(p => p.platform_name) || [],
        genres: genresRes.data || [],
      })

      setWatchlist(watchlistRes.data || [])
      setAllEloScores(eloRes.data?.map(e => e.elo_score) || [])
      setPreferenceProfile(profileRes.data || null)
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  // Load onboarding status
  const loadOnboardingStatus = async (userId) => {
    if (!isSupabaseConfigured()) return

    try {
      const { needsOnboarding, onboarding } = await checkNeedsOnboarding(userId)
      setOnboardingStatus({
        needsOnboarding,
        ...onboarding,
      })
    } catch (error) {
      console.error('Error loading onboarding status:', error)
      setOnboardingStatus({ needsOnboarding: false })
    }
  }

  // Auth functions
  const signIn = async (email, password) => {
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }
    const { data, error } = await supabaseSignIn(email, password)
    return { data, error }
  }

  const signUp = async (email, password) => {
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }
    const { data, error } = await supabaseSignUp(email, password)
    return { data, error }
  }

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }
    const { data, error } = await supabaseSignInWithGoogle()
    return { data, error }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }
    const { error } = await supabaseSignOut()
    if (!error) {
      setUser(null)
      setUserPreferences({ platforms: [], genres: [] })
      setWatchlist([])
      setAllEloScores([])
    }
    return { error }
  }

  // Preference functions
  const updatePlatforms = async (platforms) => {
    if (!user) return { error: new Error('Not authenticated') }
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }

    const { error } = await setUserPlatforms(user.id, platforms)
    if (!error) {
      setUserPreferences(prev => ({ ...prev, platforms }))
    }
    return { error }
  }

  const updateGenres = async (genres) => {
    if (!user) return { error: new Error('Not authenticated') }
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }

    const { error } = await setUserGenres(user.id, genres)
    if (!error) {
      setUserPreferences(prev => ({ ...prev, genres }))
    }
    return { error }
  }

  // Watchlist functions
  const addToWatchlist = async (item) => {
    if (!user) return { error: new Error('Not authenticated') }
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }

    const { error } = await supabaseAddToWatchlist(user.id, item)
    if (!error) {
      setWatchlist(prev => {
        const existing = prev.findIndex(w => w.tmdb_id === item.tmdb_id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { ...updated[existing], ...item, user_id: user.id }
          return updated
        }
        return [...prev, { ...item, user_id: user.id }]
      })
    }
    return { error }
  }

  const updateWatchlist = async (tmdbId, updates) => {
    if (!user) return { error: new Error('Not authenticated') }
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }

    const { error } = await updateWatchlistItem(user.id, tmdbId, updates)
    if (!error) {
      setWatchlist(prev =>
        prev.map(w => w.tmdb_id === tmdbId ? { ...w, ...updates } : w)
      )
    }
    return { error }
  }

  const removeFromWatchlist = async (tmdbId) => {
    if (!user) return { error: new Error('Not authenticated') }
    if (!isSupabaseConfigured()) return { error: new Error('Supabase not configured') }

    const { error } = await supabaseRemoveFromWatchlist(user.id, tmdbId)
    if (!error) {
      setWatchlist(prev => prev.filter(w => w.tmdb_id !== tmdbId))
    }
    return { error }
  }

  const getWatchlistStatus = (tmdbId) => {
    const item = watchlist.find(w => w.tmdb_id === tmdbId)
    return item?.status || null
  }

  // Check if user needs onboarding
  const needsOnboarding = onboardingStatus?.needsOnboarding ?? false

  const value = {
    user,
    loading,
    userPreferences,
    watchlist,
    allEloScores,
    onboardingStatus,
    preferenceProfile,
    needsOnboarding,
    isConfigured: isSupabaseConfigured(),
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updatePlatforms,
    updateGenres,
    addToWatchlist,
    updateWatchlist,
    removeFromWatchlist,
    getWatchlistStatus,
    refreshUserData: () => user && loadUserData(user.id),
    refreshOnboardingStatus: () => user && loadOnboardingStatus(user.id),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth
