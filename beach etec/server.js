const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// conexão com banco
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "", // coloca senha se tiver
    database: "agendamento"
});

db.connect((err) => {
    if(err){
        console.log("Erro ao conectar:", err);
    } else {
        console.log("Conectado ao MySQL!");
    }
});

// rota
app.post("/agendar", (req, res) => {

    const { nome, quadra, data, horario, modalidade, nivel } = req.body;

    const sql = `
    INSERT INTO agendamentos 
    (nome, quadra, data, horario, modalidade, nivel) 
    VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [nome, quadra, data, horario, modalidade, nivel], (err) => {
        if(err){
            console.log(err);
            return res.status(500).send("Erro ao salvar");
        }

        res.send("Agendamento salvo com sucesso! ✅");
    });

});

app.post("/login-google", (req, res) => {

    const { google_id, nome, email, foto } = req.body;

    const sql = `
        INSERT INTO login
        (google_id, nome, email, foto)

        VALUES (?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
            nome = VALUES(nome),
            email = VALUES(email),
            foto = VALUES(foto)
    `;

    db.query(
        sql,
        [google_id, nome, email, foto],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    erro: "Erro ao salvar"
                });
            }

            res.json({
                sucesso: true
            });
        }
    );
});


// iniciar servidor
app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});


app.get("/agendamentos", (req, res) => {
    const sql = "SELECT * FROM agendamentos ORDER BY data DESC";

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ erro: "Erro ao buscar agendamentos" });
        }

        res.json(result);
    });
});

app.post("/cadastrar", (req, res) => {

    const { nome, sobrenome, email, telefone, senha, nascimento } = req.body;

    const sql = `
    INSERT INTO usuarios 
    (nome, sobrenome, email, telefone, senha, nascimento) 
    VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [nome, sobrenome, email, telefone, senha, nascimento], (err) => {
        if(err){
            console.log(err);
            return res.status(500).send("Erro ao cadastrar");
        }

        res.send("Usuário cadastrado com sucesso! ✅");
    });

});