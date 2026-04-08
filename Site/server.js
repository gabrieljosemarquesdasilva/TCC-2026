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