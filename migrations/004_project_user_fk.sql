ALTER TABLE projects
  ADD CONSTRAINT projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;

ALTER TABLE user_annotations
  ADD CONSTRAINT user_annotations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
