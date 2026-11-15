CREATE TABLE film_videos (
  film_id TEXT PRIMARY KEY REFERENCES films(id),
  object_id TEXT NOT NULL UNIQUE,
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  ready INTEGER NOT NULL DEFAULT 0
);
