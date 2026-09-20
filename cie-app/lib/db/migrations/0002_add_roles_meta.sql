ALTER TABLE roles
ADD COLUMN meta TEXT NOT NULL DEFAULT '{}'
CHECK (json_valid(meta));

CREATE TRIGGER IF NOT EXISTS roles_set_updated_at
AFTER UPDATE ON roles
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE roles
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
