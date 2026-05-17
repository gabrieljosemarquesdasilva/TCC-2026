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

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    sobrenome VARCHAR(100),
    email VARCHAR(150),
    telefone VARCHAR(20),
    senha VARCHAR(100),
    nascimento DATE
);


CREATE TABLE login (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255),
  email VARCHAR(255),
  nome VARCHAR(255),
  picture TEXT
);

node server.js 

