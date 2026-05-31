CREATE DATABASE IF NOT EXISTS agendamento;
USE agendamento;

CREATE TABLE IF NOT EXISTS agendamentos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(100),
  quadra     VARCHAR(50),
  data       DATE,
  horario    TIME,
  modalidade VARCHAR(50),
  nivel      VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS login (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(100) NOT NULL UNIQUE,
  email     VARCHAR(255),
  nome      VARCHAR(255),
  foto      TEXT,
  senha     VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  sobrenome  VARCHAR(100) DEFAULT '',
  email      VARCHAR(255) NOT NULL UNIQUE,
  telefone   VARCHAR(20)  DEFAULT '',
  senha      VARCHAR(255) NOT NULL,
  nascimento DATE,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  senha   VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessoes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  token     VARCHAR(255) NOT NULL UNIQUE,
  admin_id  INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin padrão: login=admin  senha=admin123
INSERT IGNORE INTO admins (usuario, senha)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');

-- Para rodar: node server.js
