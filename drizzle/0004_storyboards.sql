CREATE TABLE film_storyboards (
  film_id TEXT PRIMARY KEY REFERENCES films(id),
  object_id TEXT NOT NULL UNIQUE,
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  filename TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0
);
