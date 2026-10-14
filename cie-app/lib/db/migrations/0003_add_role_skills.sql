CREATE TABLE IF NOT EXISTS role_skills (
  id TEXT PRIMARY KEY,
  role_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_skills_role_id
ON role_skills (role_id, sort_order);

CREATE TABLE IF NOT EXISTS skill_competencies (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES role_skills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_competencies_skill_id
ON skill_competencies (skill_id, sort_order);
