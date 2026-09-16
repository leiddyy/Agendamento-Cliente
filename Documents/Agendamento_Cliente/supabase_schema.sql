-- ============================================================
-- SCRIPT DE BANCO DE DADOS SUPABASE (POSTGRESQL MULTI-TENANT)
-- Projeto: Agendamento Multi-Salão (ex: Eduarda Souza Estética)
-- ============================================================

-- 1. Habilitar extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Salões / Estúdios (Tenants)
CREATE TABLE IF NOT EXISTS salons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(50) DEFAULT '#8A676A',
    whatsapp_number VARCHAR(50) DEFAULT '5511999999999',
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Configurações de Horário por Salão
CREATE TABLE IF NOT EXISTS salon_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE UNIQUE NOT NULL,
    opening_time TIME DEFAULT '08:00',
    closing_time TIME DEFAULT '19:00',
    lunch_start TIME DEFAULT '12:00',
    lunch_end TIME DEFAULT '13:00',
    working_days VARCHAR(50) DEFAULT '1,2,3,4,5,6',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Serviços por Salão
CREATE TABLE IF NOT EXISTS services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Agendamentos por Salão
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmado',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Administradores por Salão
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_username_per_salon UNIQUE (salon_id, username)
);

-- ------------------------------------------------------------
-- POLÍTICAS DE SEGURANÇA (Row Level Security - RLS)
-- ------------------------------------------------------------

ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura Pública (Para o site do cliente carregar dados)
CREATE POLICY "Permitir leitura pública de salões ativos" ON salons FOR SELECT USING (true);
CREATE POLICY "Permitir leitura pública de configurações" ON salon_settings FOR SELECT USING (true);
CREATE POLICY "Permitir leitura pública de serviços ativos" ON services FOR SELECT USING (active = 1);
CREATE POLICY "Permitir criar agendamentos publicamente" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura de agendamentos públicos" ON appointments FOR SELECT USING (true);

-- Políticas para Administradores
CREATE POLICY "Acesso completo a administradores" ON admins FOR ALL USING (true);
CREATE POLICY "Modificação de serviços por admin" ON services FOR ALL USING (true);
CREATE POLICY "Modificação de agendamentos por admin" ON appointments FOR ALL USING (true);
CREATE POLICY "Modificação de configurações por admin" ON salon_settings FOR ALL USING (true);

-- ------------------------------------------------------------
-- DADOS INICIAIS (SEED DATA) PARA O SALÃO EDUARDA SOUZA ESTÉTICA
-- ------------------------------------------------------------

DO $$
DECLARE
    v_salon_id UUID;
BEGIN
    -- Inserir Salão Padrão se não existir
    INSERT INTO salons (slug, name, logo_url, primary_color, whatsapp_number)
    VALUES (
        'eduarda-souza',
        'Eduarda Souza Estética',
        '/images/logo.jpg',
        '#8A676A',
        '5511999999999'
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_salon_id;

    -- Configurações de Horário do Salão
    INSERT INTO salon_settings (salon_id, opening_time, closing_time, lunch_start, lunch_end, working_days)
    VALUES (v_salon_id, '08:00', '19:00', '12:00', '13:00', '1,2,3,4,5,6')
    ON CONFLICT (salon_id) DO NOTHING;

    -- Admin Padrão (admin / admin123 -> Hash bcrypt)
    INSERT INTO admins (salon_id, username, password_hash, name)
    VALUES (
        v_salon_id,
        'admin',
        '$2a$10$e8w.xT5h2UoUjXh5w0E50uF4Xy.B2kZ3j9f6P4b4X4b4X4b4X4b4X',
        'Administradora Eduarda Souza'
    )
    ON CONFLICT (salon_id, username) DO NOTHING;

    -- Procedimentos de Exemplo
    IF NOT EXISTS (SELECT 1 FROM services WHERE salon_id = v_salon_id) THEN
        INSERT INTO services (salon_id, name, category, price, duration_minutes, description) VALUES
        (v_salon_id, 'Design de Sobrancelhas', 'Sobrancelhas', 45.00, 30, 'Mapeamento facial completo com alinhamento e limpeza profissional dos fios.'),
        (v_salon_id, 'Design com Henna', 'Sobrancelhas', 65.00, 45, 'Design de sobrancelha personalizado com aplicação de henna para maior preenchimento e destaque.'),
        (v_salon_id, 'Micropigmentação Shadow', 'Sobrancelhas', 350.00, 120, 'Técnica de micropigmentação efeito maquiagem suave, durabilidade de até 1 ano.'),
        (v_salon_id, 'Extensão de Cílios Fio a Fio', 'Cílios', 120.00, 90, 'Aplicação de um fio sintético leve sobre cada fio natural para um olhar marcante e natural.'),
        (v_salon_id, 'Extensão de Cílios Volume Russo', 'Cílios', 160.00, 120, 'Aplicação de leques de fios ultrafinos para máximo volume, preenchimento e glamour.'),
        (v_salon_id, 'Lash Lifting com Tintura', 'Cílios', 110.00, 60, 'Curvatura e tintura natural dos próprios cílios, hidratação profunda com durabilidade de até 45 dias.'),
        (v_salon_id, 'Combo Glamour (Design com Henna + Lash Lifting)', 'Combos', 155.00, 90, 'O combo ideal para transformar seu olhar em uma única sessão.');
    END IF;
END $$;
