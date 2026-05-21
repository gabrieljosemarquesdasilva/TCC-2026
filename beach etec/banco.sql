CREATE DATABASE agendamento;

USE agendamento;

CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    quadra VARCHAR(50),
    data DATE,
    horario TIME,
    modalidade VARCHAR(50),
    nivel VARCHAR(50)
);

CREATE TABLE login (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  nome VARCHAR(255),
  foto TEXT,
  senha VARCHAR(20)
);


node server.js 

