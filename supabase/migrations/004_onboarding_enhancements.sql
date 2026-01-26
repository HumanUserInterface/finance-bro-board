-- Finance Bro Board - Onboarding Enhancements
-- Adds French social benefits, onboarding tracking, and PDF document storage

-- Add new income source types for French social benefits
-- First, we need to drop the existing constraint and recreate it with the new values
ALTER TABLE public.income_sources DROP CONSTRAINT income_sources_type_check;
ALTER TABLE public.income_sources ADD CONSTRAINT income_sources_type_check
  CHECK (type IN ('salary', 'side_income', 'investments', 'rental', 'apl', 'prime_activite', 'other'));

-- Add onboarding tracking fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN monthly_income_last_updated TIMESTAMPTZ;

-- Create uploaded_documents table for storing PDF metadata and parsed data
-- Note: file_path is nullable since we extract data and don't store the actual PDF
CREATE TABLE public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('paycheck', 'benefit_statement', 'other')),
  parsed_data JSONB,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for uploaded_documents
CREATE INDEX idx_uploaded_documents_user ON public.uploaded_documents(user_id);
CREATE INDEX idx_uploaded_documents_type ON public.uploaded_documents(document_type);

-- Enable RLS on uploaded_documents
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uploaded_documents
CREATE POLICY "Users can manage own documents" ON public.uploaded_documents FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket for paychecks
-- Note: This needs to be run in the Supabase dashboard or via the API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('paychecks', 'paychecks', false);

-- Storage policies (to be applied after bucket creation)
-- CREATE POLICY "Users can upload own paychecks" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'paychecks' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can view own paychecks" ON storage.objects FOR SELECT
--   USING (bucket_id = 'paychecks' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own paychecks" ON storage.objects FOR DELETE
--   USING (bucket_id = 'paychecks' AND auth.uid()::text = (storage.foldername(name))[1]);
