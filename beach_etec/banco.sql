-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agendamentos (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(100),
  quadra      VARCHAR(50),
  data        DATE,
  horario     TIME,
  modalidade  VARCHAR(50),
  nivel       VARCHAR(50),
  status      VARCHAR(20) DEFAULT 'pendente',
  usuario_id  INT REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Se a tabela já existia, rode os ALTERs abaixo no Supabase:
-- ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente';
-- ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS login (
  id        SERIAL PRIMARY KEY,
  google_id VARCHAR(100) NOT NULL UNIQUE,
  email     VARCHAR(255),
  nome      VARCHAR(255),
  foto      TEXT,
  senha     VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  sobrenome  VARCHAR(100) DEFAULT '',
  email      VARCHAR(255) NOT NULL UNIQUE,
  telefone   VARCHAR(20)  DEFAULT '',
  senha      VARCHAR(255) NOT NULL,
  nascimento DATE,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Admins agora têm email (para detectar no login do site)
CREATE TABLE IF NOT EXISTS admins (
  id      SERIAL PRIMARY KEY,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  email   VARCHAR(255) UNIQUE,
  senha   VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessoes (
  id        SERIAL PRIMARY KEY,
  token     VARCHAR(255) NOT NULL UNIQUE,
  admin_id  INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuario_sessoes (
  id          SERIAL PRIMARY KEY,
  token       VARCHAR(255) NOT NULL UNIQUE,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Admin padrão: usuario=admin / senha=admin123
-- SHA-256 de "admin123"
INSERT INTO admins (usuario, senha)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON CONFLICT (usuario) DO NOTHING;

-- Para adicionar o e-mail ao admin (substitua pelo e-mail real):
-- UPDATE admins SET email='seuemail@exemplo.com' WHERE usuario='admin';

-- ═══ TABELA DE QUADRAS DINÂMICAS ═══
CREATE TABLE IF NOT EXISTS quadras (
  id           SERIAL PRIMARY KEY,
  nome         VARCHAR(100) NOT NULL,
  descricao    TEXT DEFAULT '',
  badges       JSONB DEFAULT '[]',
  fotos        JSONB DEFAULT '[]',
  ordem        INT DEFAULT 0,
  endereco     VARCHAR(255) DEFAULT '',
  capacidade   INT DEFAULT NULL,
  funcionamento VARCHAR(120) DEFAULT '',
  piso         VARCHAR(60)  DEFAULT '',
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);
-- Se a tabela já existia, rode:
-- ALTER TABLE quadras ADD COLUMN IF NOT EXISTS endereco VARCHAR(255) DEFAULT '';
-- ALTER TABLE quadras ADD COLUMN IF NOT EXISTS capacidade INT;
-- ALTER TABLE quadras ADD COLUMN IF NOT EXISTS funcionamento VARCHAR(120) DEFAULT '';
-- ALTER TABLE quadras ADD COLUMN IF NOT EXISTS piso VARCHAR(60) DEFAULT '';

-- ═══ FOTO DE PERFIL + XP/NÍVEL DO JOGADOR ═══
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT '';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nivel_jogo VARCHAR(50) DEFAULT '';

-- ═══ RESERVAS COM DURAÇÃO EM HORAS + XP JÁ CONCEDIDO ═══
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS duracao INT DEFAULT 1;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS grupo_id VARCHAR(40);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS xp_concedido BOOLEAN DEFAULT false;

-- Dados iniciais (rode apenas se quiser migrar as quadras fixas para o banco)
-- INSERT INTO quadras (nome, descricao, badges, ordem) VALUES
--   ('Arena dos Pássaros', 'Quadra de areia profissional com iluminação noturna de alta potência.', '["💡 Iluminação noturna","🏟️ Areia profissional"]', 1),
--   ('Arena dos Amigos', 'Espaço amplo e confortável, ideal para partidas recreativas.', '["🎉 Eventos","👥 Recreativo"]', 2),
--   ('Arena Premium', 'Quadra moderna com estrutura premium e areia selecionada.', '["⭐ Premium","🏆 Competição"]', 3);
