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

CREATE DATABASE usuarios;

USE usuarios;

CREATE TABLE login (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255),
  email VARCHAR(255),
  nome VARCHAR(255),
  picture TEXT
);

node server.js 

