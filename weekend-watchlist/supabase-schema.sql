-- Weekend Watchlist - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- User platforms table
-- Stores which streaming platforms each user has subscribed to
CREATE TABLE IF NOT EXISTS user_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, platform_name)
);

-- Enable Row Level Security
ALTER TABLE user_platforms ENABLE ROW LEVEL SECURITY;

-- Policies for user_platforms
CREATE POLICY "Users can view own platforms" ON user_platforms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own platforms" ON user_platforms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own platforms" ON user_platforms
  FOR DELETE USING (auth.uid() = user_id);


-- User genres table
-- Stores user's genre preferences with weights for recommendation scoring
CREATE TABLE IF NOT EXISTS user_genres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  genre_id INTEGER NOT NULL,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, genre_id)
);

-- Enable Row Level Security
ALTER TABLE user_genres ENABLE ROW LEVEL SECURITY;

-- Policies for user_genres
CREATE POLICY "Users can view own genres" ON user_genres
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own genres" ON user_genres
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own genres" ON user_genres
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own genres" ON user_genres
  FOR DELETE USING (auth.uid() = user_id);


-- User watchlist table
-- Stores user's saved movies/shows with their status and ratings
CREATE TABLE IF NOT EXISTS user_watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  status TEXT NOT NULL CHECK (status IN ('want_to_watch', 'watched', 'not_interested')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tmdb_id)
);

-- Enable Row Level Security
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

-- Policies for user_watchlist
CREATE POLICY "Users can view own watchlist" ON user_watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON user_watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON user_watchlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON user_watchlist
  FOR DELETE USING (auth.uid() = user_id);


-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for watchlist updated_at
CREATE TRIGGER update_user_watchlist_updated_at
  BEFORE UPDATE ON user_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_platforms_user_id ON user_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_genres_user_id ON user_genres(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_status ON user_watchlist(user_id, status);


-- =====================================================
-- MOVIE RANKING FEATURES - Letterboxd + Elo Ranking
-- =====================================================

-- Add new columns to user_watchlist for Elo ranking
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS elo_score INTEGER DEFAULT 1500;
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS comparison_count INTEGER DEFAULT 0;
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS imported_from TEXT;
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS letterboxd_rating DECIMAL(2,1);
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS review TEXT;
ALTER TABLE user_watchlist ADD COLUMN IF NOT EXISTS review_updated_at TIMESTAMP WITH TIME ZONE;


-- User Letterboxd connection table
-- Stores the user's connected Letterboxd account
CREATE TABLE IF NOT EXISTS user_letterboxd (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  letterboxd_username TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_letterboxd ENABLE ROW LEVEL SECURITY;

-- Policies for user_letterboxd
CREATE POLICY "Users can view own letterboxd" ON user_letterboxd
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own letterboxd" ON user_letterboxd
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own letterboxd" ON user_letterboxd
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own letterboxd" ON user_letterboxd
  FOR DELETE USING (auth.uid() = user_id);


-- User comparisons table
-- Stores pairwise comparison results for Elo ranking
CREATE TABLE IF NOT EXISTS user_comparisons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  winner_tmdb_id INTEGER NOT NULL,
  winner_media_type TEXT NOT NULL CHECK (winner_media_type IN ('movie', 'tv')),
  loser_tmdb_id INTEGER NOT NULL,
  loser_media_type TEXT NOT NULL CHECK (loser_media_type IN ('movie', 'tv')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_comparisons ENABLE ROW LEVEL SECURITY;

-- Policies for user_comparisons
CREATE POLICY "Users can view own comparisons" ON user_comparisons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparisons" ON user_comparisons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparisons" ON user_comparisons
  FOR DELETE USING (auth.uid() = user_id);


-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_user_letterboxd_user_id ON user_letterboxd(user_id);
CREATE INDEX IF NOT EXISTS idx_user_comparisons_user_id ON user_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_elo ON user_watchlist(user_id, elo_score DESC);


-- Migration: Initialize Elo scores from existing star ratings
-- Run this once to convert existing ratings to Elo scores
-- UPDATE user_watchlist SET elo_score = CASE
--   WHEN rating = 5 THEN 1800
--   WHEN rating = 4 THEN 1650
--   WHEN rating = 3 THEN 1500
--   WHEN rating = 2 THEN 1350
--   WHEN rating = 1 THEN 1200
--   ELSE 1500
-- END WHERE rating IS NOT NULL;
