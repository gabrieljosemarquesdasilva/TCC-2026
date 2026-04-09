CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100),
    sobrenome VARCHAR(100),
    email VARCHAR(150),
    telefone VARCHAR(20),
    senha VARCHAR(100),
    nascimento DATE
);