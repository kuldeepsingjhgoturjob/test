/*
# Candidate accounts: profiles, resumes, applications, saved jobs

1. Plain-English summary
- Adds the data needed for candidate accounts. Each signed-in candidate can keep a profile, upload resumes, see the jobs they applied to, and save jobs.
- Existing jobs, applications and Premium data (stored in Netlify Blobs) are NOT touched by this migration.

2. New tables
- candidate_profiles: one row per candidate account (name, phone, city, state, country, headline, skills, education, experience, preferred location, expected salary in INR).
- candidate_resumes: metadata for each uploaded resume. The file itself lives in the private storage bucket "candidate-resumes", inside a folder named after the candidate's user id.
- candidate_applications: one row per job a candidate applied to. Stores the job reference from Netlify Blobs and the matching application id there.
- saved_jobs: jobs a candidate bookmarked.

3. Security
- Row level security is enabled on every new table.
- Only the signed-in owner (auth.uid()) can read, insert, update or delete their own rows. Anonymous visitors get no access.
- Table access is granted to the "authenticated" role only.
- Storage bucket is private. Candidates can only read, upload and delete files inside their own folder.

4. Notes
- No delete access is granted on candidate_profiles or candidate_applications, so history is kept.
- Country defaults to India (IN). Phone numbers are stored as digits with the +91 country code added in the app.
- Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'IN',
  headline text NOT NULL DEFAULT '',
  skills text NOT NULL DEFAULT '',
  education text NOT NULL DEFAULT '',
  experience_years numeric(4,1),
  preferred_location text NOT NULL DEFAULT '',
  expected_salary_inr integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_resumes_user_id_idx ON candidate_resumes (user_id);

CREATE TABLE IF NOT EXISTS candidate_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_ref text NOT NULL,
  job_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  blob_application_id text NOT NULL DEFAULT '',
  resume_id uuid REFERENCES candidate_resumes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'applied',
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_ref)
);
CREATE INDEX IF NOT EXISTS candidate_applications_user_id_idx ON candidate_applications (user_id);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_ref text NOT NULL,
  job_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_ref)
);

ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON candidate_profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON candidate_resumes TO authenticated;
GRANT SELECT, INSERT ON candidate_applications TO authenticated;
GRANT SELECT, INSERT, DELETE ON saved_jobs TO authenticated;

DROP POLICY IF EXISTS "select_own_candidate_profile" ON candidate_profiles;
CREATE POLICY "select_own_candidate_profile" ON candidate_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_candidate_profile" ON candidate_profiles;
CREATE POLICY "insert_own_candidate_profile" ON candidate_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_candidate_profile" ON candidate_profiles;
CREATE POLICY "update_own_candidate_profile" ON candidate_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_candidate_resumes" ON candidate_resumes;
CREATE POLICY "select_own_candidate_resumes" ON candidate_resumes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_candidate_resumes" ON candidate_resumes;
CREATE POLICY "insert_own_candidate_resumes" ON candidate_resumes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_candidate_resumes" ON candidate_resumes;
CREATE POLICY "delete_own_candidate_resumes" ON candidate_resumes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_candidate_applications" ON candidate_applications;
CREATE POLICY "select_own_candidate_applications" ON candidate_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_candidate_applications" ON candidate_applications;
CREATE POLICY "insert_own_candidate_applications" ON candidate_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_saved_jobs" ON saved_jobs;
CREATE POLICY "select_own_saved_jobs" ON saved_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_saved_jobs" ON saved_jobs;
CREATE POLICY "insert_own_saved_jobs" ON saved_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_saved_jobs" ON saved_jobs;
CREATE POLICY "delete_own_saved_jobs" ON saved_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-resumes', 'candidate-resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "candidates_read_own_resume_files" ON storage.objects;
CREATE POLICY "candidates_read_own_resume_files" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'candidate-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "candidates_upload_own_resume_files" ON storage.objects;
CREATE POLICY "candidates_upload_own_resume_files" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'candidate-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "candidates_delete_own_resume_files" ON storage.objects;
CREATE POLICY "candidates_delete_own_resume_files" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'candidate-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
