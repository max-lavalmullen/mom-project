import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: Log what values Vite is loading
console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key exists:', !!supabaseAnonKey)

// Create a mock client if credentials are missing (for demo mode)
const isConfigured = supabaseUrl && supabaseAnonKey

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = () => isConfigured

// Auth functions
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// User platforms
export const getUserPlatforms = async (userId) => {
  const { data, error } = await supabase
    .from('user_platforms')
    .select('platform_name')
    .eq('user_id', userId)
  return { data, error }
}

export const setUserPlatforms = async (userId, platforms) => {
  // Delete existing platforms
  await supabase
    .from('user_platforms')
    .delete()
    .eq('user_id', userId)

  // Insert new platforms
  if (platforms.length > 0) {
    const { data, error } = await supabase
      .from('user_platforms')
      .insert(platforms.map(p => ({ user_id: userId, platform_name: p })))
    return { data, error }
  }
  return { data: [], error: null }
}

// User genres
export const getUserGenres = async (userId) => {
  const { data, error } = await supabase
    .from('user_genres')
    .select('genre_id, weight')
    .eq('user_id', userId)
  return { data, error }
}

export const setUserGenres = async (userId, genres) => {
  // Delete existing genres
  await supabase
    .from('user_genres')
    .delete()
    .eq('user_id', userId)

  // Insert new genres
  if (genres.length > 0) {
    const { data, error } = await supabase
      .from('user_genres')
      .insert(genres.map(g => ({
        user_id: userId,
        genre_id: g.id,
        weight: g.weight || 1
      })))
    return { data, error }
  }
  return { data: [], error: null }
}

// User watchlist
export const getUserWatchlist = async (userId) => {
  const { data, error } = await supabase
    .from('user_watchlist')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

export const addToWatchlist = async (userId, item) => {
  const { data, error } = await supabase
    .from('user_watchlist')
    .upsert({
      user_id: userId,
      tmdb_id: item.tmdb_id,
      media_type: item.media_type,
      status: item.status,
      rating: item.rating || null,
    }, {
      onConflict: 'user_id,tmdb_id'
    })
  return { data, error }
}

export const updateWatchlistItem = async (userId, tmdbId, updates) => {
  const { data, error } = await supabase
    .from('user_watchlist')
    .update(updates)
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
  return { data, error }
}

export const removeFromWatchlist = async (userId, tmdbId) => {
  const { data, error } = await supabase
    .from('user_watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
  return { data, error }
}

// Get user's Elo scores for star calculation
export const getUserEloScores = async (userId) => {
  const { data, error } = await supabase
    .from('user_watchlist')
    .select('elo_score')
    .eq('user_id', userId)
    .eq('status', 'watched')
  return { data, error }
}

// Get user's comparison count
export const getUserComparisonCount = async (userId) => {
  const { data, error } = await supabase
    .from('user_comparisons')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
  return { count: data?.length || 0, error }
}

// ============================================
// Platform Imports
// ============================================

// Get user's platform imports
export const getUserPlatformImports = async (userId) => {
  const { data, error } = await supabase
    .from('user_platform_imports')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

// Create or update platform import record
export const createPlatformImport = async (userId, platformName, status = 'pending') => {
  const { data, error } = await supabase
    .from('user_platform_imports')
    .upsert({
      user_id: userId,
      platform_name: platformName,
      import_status: status,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,platform_name',
    })
  return { data, error }
}

// Update platform import
export const updatePlatformImport = async (userId, platformName, updates) => {
  const { data, error } = await supabase
    .from('user_platform_imports')
    .update(updates)
    .eq('user_id', userId)
    .eq('platform_name', platformName)
  return { data, error }
}

// Get import status for a specific platform
export const getPlatformImportStatus = async (userId, platformName) => {
  const { data, error } = await supabase
    .from('user_platform_imports')
    .select('*')
    .eq('user_id', userId)
    .eq('platform_name', platformName)
    .single()
  return { data, error }
}

// ============================================
// User Preference Profiles
// ============================================

// Get user's preference profile
export const getUserPreferenceProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_preference_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

// Create or update preference profile
export const upsertPreferenceProfile = async (userId, profile) => {
  const { data, error } = await supabase
    .from('user_preference_profiles')
    .upsert({
      user_id: userId,
      ...profile,
    }, {
      onConflict: 'user_id',
    })
  return { data, error }
}

// Recompute preference profile (trigger recomputation)
export const recomputePreferenceProfile = async (userId) => {
  // Import here to avoid circular dependency
  const { computePreferenceProfile } = await import('./preferenceEngine')
  return computePreferenceProfile(userId)
}

// ============================================
// User Onboarding
// ============================================

// Get user's onboarding status
export const getUserOnboarding = async (userId) => {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

// Create onboarding record
export const createUserOnboarding = async (userId) => {
  const { data, error } = await supabase
    .from('user_onboarding')
    .insert({
      user_id: userId,
      onboarding_completed: false,
      skipped_import: false,
    })
  return { data, error }
}

// Update onboarding status
export const updateUserOnboarding = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_onboarding')
    .upsert({
      user_id: userId,
      ...updates,
    }, {
      onConflict: 'user_id',
    })
  return { data, error }
}

// Complete onboarding
export const completeOnboarding = async (userId, skippedImport = false) => {
  return updateUserOnboarding(userId, {
    onboarding_completed: true,
    skipped_import: skippedImport,
  })
}

// Check if user needs onboarding
export const checkNeedsOnboarding = async (userId) => {
  const { data, error } = await getUserOnboarding(userId)

  // If no onboarding record exists, or onboarding is not completed, they need onboarding
  if (error && error.code === 'PGRST116') {
    // No record found - needs onboarding
    return { needsOnboarding: true, onboarding: null }
  }

  if (error) {
    console.error('Error checking onboarding status:', error)
    return { needsOnboarding: false, onboarding: null }
  }

  return {
    needsOnboarding: !data.onboarding_completed,
    onboarding: data,
  }
}

// SQL for creating tables (run in Supabase SQL editor):
/*
-- Enable RLS
alter database postgres set "app.jwt_secret" to 'your-jwt-secret';

-- Users table is handled by Supabase Auth

-- User platforms
create table user_platforms (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  platform_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, platform_name)
);

alter table user_platforms enable row level security;

create policy "Users can view own platforms" on user_platforms
  for select using (auth.uid() = user_id);

create policy "Users can insert own platforms" on user_platforms
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own platforms" on user_platforms
  for delete using (auth.uid() = user_id);

-- User genres
create table user_genres (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  genre_id integer not null,
  weight integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, genre_id)
);

alter table user_genres enable row level security;

create policy "Users can view own genres" on user_genres
  for select using (auth.uid() = user_id);

create policy "Users can insert own genres" on user_genres
  for insert with check (auth.uid() = user_id);

create policy "Users can update own genres" on user_genres
  for update using (auth.uid() = user_id);

create policy "Users can delete own genres" on user_genres
  for delete using (auth.uid() = user_id);

-- User watchlist
create table user_watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tmdb_id integer not null,
  media_type text not null,
  status text not null check (status in ('want_to_watch', 'watched', 'not_interested')),
  rating integer check (rating >= 1 and rating <= 5),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, tmdb_id)
);

alter table user_watchlist enable row level security;

create policy "Users can view own watchlist" on user_watchlist
  for select using (auth.uid() = user_id);

create policy "Users can insert own watchlist" on user_watchlist
  for insert with check (auth.uid() = user_id);

create policy "Users can update own watchlist" on user_watchlist
  for update using (auth.uid() = user_id);

create policy "Users can delete own watchlist" on user_watchlist
  for delete using (auth.uid() = user_id);
*/
