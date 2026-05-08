-- Source Bias Atlas — production crawler schema (atlas.db)

CREATE TABLE IF NOT EXISTS tags (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  handle TEXT,
  name TEXT,
  image TEXT,
  description TEXT,
  is_squad INTEGER NOT NULL DEFAULT 0,
  posts_collected INTEGER NOT NULL DEFAULT 0,
  oldest_post_at TEXT,
  newest_post_at TEXT,
  is_exhausted INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_crawled_at TEXT,
  error_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_sources_squad ON sources(is_squad);
CREATE INDEX IF NOT EXISTS idx_sources_exhausted ON sources(is_exhausted);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  summary TEXT,
  image TEXT,
  type TEXT,
  read_time INTEGER,
  num_upvotes INTEGER,
  num_comments INTEGER,
  created_at TEXT NOT NULL,
  published_at TEXT,
  author_name TEXT,
  tags_json TEXT,
  raw_json TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  requests_made INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

-- Per-tag progress tracking for resumability
CREATE TABLE IF NOT EXISTS tag_progress (
  tag TEXT PRIMARY KEY,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  last_cursor TEXT
);

-- Per-feed sweep progress (popular, discussed)
CREATE TABLE IF NOT EXISTS feed_progress (
  feed TEXT PRIMARY KEY,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  last_cursor TEXT
);
