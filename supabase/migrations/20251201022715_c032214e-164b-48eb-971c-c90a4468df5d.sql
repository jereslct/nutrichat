-- =====================================================
-- FOODTALK: Sistema Médico-Paciente
-- Migración limpia con roles + invitaciones (ORDENADA)
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. LIMPIAR DATOS EXISTENTES
-- =====================================================

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS diets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS doctor_patients CASCADE;
DROP TABLE IF EXISTS patient_summaries CASCADE;

-- =====================================================
-- 2. CREAR TODAS LAS TABLAS (sin policies cross-reference)
-- =====================================================

-- TABLA: profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- TABLA: diets
CREATE TABLE public.diets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  pdf_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_diets_user ON public.diets(user_id);
ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;

-- TABLA: chat_messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  diet_id UUID REFERENCES public.diets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at DESC);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- TABLA: doctor_patients
CREATE TABLE public.doctor_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_code TEXT UNIQUE,
  assigned_by TEXT NOT NULL DEFAULT 'invitation' CHECK (assigned_by IN ('invitation', 'admin')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_id, patient_id)
);

CREATE INDEX idx_doctor_patients_doctor ON public.doctor_patients(doctor_id);
CREATE INDEX idx_doctor_patients_patient ON public.doctor_patients(patient_id);
CREATE INDEX idx_doctor_patients_code ON public.doctor_patients(invitation_code);
ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;

-- TABLA: patient_summaries
CREATE TABLE public.patient_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  topics JSONB DEFAULT '[]'::jsonb,
  key_concerns JSONB DEFAULT '[]'::jsonb,
  chat_messages_analyzed INTEGER DEFAULT 0,
  last_chat_date TIMESTAMP WITH TIME ZONE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patient_summaries_patient ON public.patient_summaries(patient_id);
CREATE INDEX idx_patient_summaries_doctor ON public.patient_summaries(doctor_id);
ALTER TABLE public.patient_summaries ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. POLÍTICAS RLS - profiles
-- =====================================================

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Doctors can view patients profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patients 
      WHERE doctor_id = auth.uid() AND patient_id = profiles.id
    )
  );

-- =====================================================
-- 4. POLÍTICAS RLS - diets
-- =====================================================

CREATE POLICY "Patients manage own diet" ON public.diets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Doctors view patients diets" ON public.diets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patients 
      WHERE doctor_id = auth.uid() AND patient_id = diets.user_id
    )
  );

-- =====================================================
-- 5. POLÍTICAS RLS - chat_messages
-- =====================================================

CREATE POLICY "Patients view own chat" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients insert own chat" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. POLÍTICAS RLS - doctor_patients
-- =====================================================

CREATE POLICY "Doctors view own patients" ON public.doctor_patients
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Patients view own doctors" ON public.doctor_patients
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors create relationships" ON public.doctor_patients
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

-- =====================================================
-- 7. POLÍTICAS RLS - patient_summaries
-- =====================================================

CREATE POLICY "Doctors view patient summaries" ON public.patient_summaries
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors manage summaries" ON public.patient_summaries
  FOR ALL USING (auth.uid() = doctor_id);

-- =====================================================
-- 8. FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para generar código de invitación
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diets_updated_at
  BEFORE UPDATE ON public.diets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_summaries_updated_at
  BEFORE UPDATE ON public.patient_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();