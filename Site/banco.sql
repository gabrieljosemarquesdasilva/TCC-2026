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

