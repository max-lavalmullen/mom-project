-- Migration: Platform Imports and Tiered Recommendations
-- Run this in Supabase SQL Editor

-- Track platform import status
CREATE TABLE IF NOT EXISTS user_platform_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_name TEXT NOT NULL,
  import_status TEXT NOT NULL CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
  items_imported INTEGER DEFAULT 0,
  items_matched INTEGER DEFAULT 0,
  last_import_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, platform_name)
);

ALTER TABLE user_platform_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform imports" ON user_platform_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own platform imports" ON user_platform_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own platform imports" ON user_platform_imports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own platform imports" ON user_platform_imports
  FOR DELETE USING (auth.uid() = user_id);

-- Aggregated user preference profile
CREATE TABLE IF NOT EXISTS user_preference_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  genre_preferences JSONB DEFAULT '{}',
  preferred_actors JSONB DEFAULT '[]',
  preferred_directors JSONB DEFAULT '[]',
  completion_rate DECIMAL(3,2),
  movie_vs_tv_ratio DECIMAL(3,2),
  data_tier TEXT DEFAULT 'none' CHECK (data_tier IN ('full', 'partial', 'none')),
  total_imported_items INTEGER DEFAULT 0,
  last_computed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE user_preference_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preference profile" ON user_preference_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preference profile" ON user_preference_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preference profile" ON user_preference_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preference profile" ON user_preference_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Onboarding status
CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  onboarding_completed BOOLEAN DEFAULT false,
  skipped_import BOOLEAN DEFAULT false,
  selected_platforms JSONB DEFAULT '[]',
  import_platforms JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding" ON user_onboarding
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding" ON user_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" ON user_onboarding
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding" ON user_onboarding
  FOR DELETE USING (auth.uid() = user_id);

-- Extend existing watchlist with import tracking
ALTER TABLE user_watchlist
  ADD COLUMN IF NOT EXISTS watch_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completion_percentage INTEGER,
  ADD COLUMN IF NOT EXISTS watch_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS import_source TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_watchlist_import_source ON user_watchlist(user_id, import_source);
CREATE INDEX IF NOT EXISTS idx_user_platform_imports_user ON user_platform_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preference_profiles_user ON user_preference_profiles(user_id);
