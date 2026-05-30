const express = require("express");
const mysql   = require("mysql2");
const cors    = require("cors");
const crypto  = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost", user: "root", password: "", database: "agendamento"
});
db.connect(err => {
  if (err) console.error("Erro MySQL:", err);
  else     console.log("✅ MySQL conectado!");
});

const hash = str => crypto.createHash("sha256").update(str).digest("hex");

/* ═══════════════ USUÁRIOS ═══════════════ */
app.post("/cadastrar", (req, res) => {
  const { nome, sobrenome, email, telefone, senha, nascimento } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Nome, e-mail e senha obrigatórios." });
  db.query("SELECT id FROM usuarios WHERE email=?", [email], (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro interno." });
    if (rows.length) return res.status(409).json({ erro: "E-mail já cadastrado." });
    db.query(
      "INSERT INTO usuarios (nome,sobrenome,email,telefone,senha,nascimento) VALUES(?,?,?,?,?,?)",
      [nome, sobrenome||"", email, telefone||"", hash(senha), nascimento||null],
      err => {
        if (err) return res.status(500).json({ erro: "Erro ao cadastrar." });
        res.json({ sucesso: true, mensagem: "Conta criada!" });
      }
    );
  });
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha." });
  db.query(
    "SELECT id,nome,sobrenome,email FROM usuarios WHERE email=? AND senha=?",
    [email, hash(senha)],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro interno." });
      if (!rows.length) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
      const u = rows[0];
      res.json({ sucesso: true, usuario: { id:u.id, nome:u.nome+(u.sobrenome?" "+u.sobrenome:""), email:u.email, foto:null }});
    }
  );
});

app.post("/login-google", (req, res) => {
  const { google_id, nome, email, foto } = req.body;
  db.query(
    "INSERT INTO login(google_id,nome,email,foto) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE nome=VALUES(nome),email=VALUES(email),foto=VALUES(foto)",
    [google_id, nome, email, foto],
    err => err ? res.status(500).json({erro:"Erro."}) : res.json({sucesso:true})
  );
});

/* ═══════════════ AGENDAMENTOS ═══════════════ */
app.post("/agendar", (req, res) => {
  const { nome, quadra, data, horario, modalidade, nivel } = req.body;
  db.query(
    "INSERT INTO agendamentos(nome,quadra,data,horario,modalidade,nivel) VALUES(?,?,?,?,?,?)",
    [nome, quadra, data, horario, modalidade, nivel],
    err => err ? res.status(500).json({erro:"Erro ao salvar."}) : res.json({sucesso:true,mensagem:"Agendado! ✅"})
  );
});

app.get("/agendamentos", (req, res) => {
  db.query("SELECT * FROM agendamentos ORDER BY data DESC", (err,rows) =>
    err ? res.status(500).json({erro:"Erro."}) : res.json(rows)
  );
});

/* ═══════════════ ADMIN AUTH ═══════════════ */
app.post("/admin/auth", (req, res) => {
  const { usuario, senha } = req.body;
  db.query("SELECT id,usuario FROM admins WHERE usuario=? AND senha=?", [usuario, hash(senha)], (err, rows) => {
    if (err) return res.status(500).json({erro:"Erro interno."});
    if (!rows.length) return res.status(401).json({erro:"Usuário ou senha incorretos."});
    const token = hash(rows[0].id + Date.now() + "beach_etec_2025");
    db.query("INSERT INTO admin_sessoes(token,admin_id) VALUES(?,?)", [token, rows[0].id], err2 =>
      err2 ? res.status(500).json({erro:"Erro ao criar sessão."})
           : res.json({sucesso:true, token, admin: rows[0].usuario})
    );
  });
});

app.post("/admin/logout", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token) return res.json({sucesso:true});
  db.query("DELETE FROM admin_sessoes WHERE token=?", [token], () => res.json({sucesso:true}));
});

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token) return res.status(401).json({erro:"Não autorizado."});
  db.query("SELECT id FROM admin_sessoes WHERE token=?", [token], (err, rows) =>
    (err || !rows.length) ? res.status(401).json({erro:"Token inválido."}) : next()
  );
}

/* ═══════════════ ADMIN — STATS ═══════════════ */
app.get("/admin/stats", adminAuth, (req, res) => {
  const qs = {
    total_usuarios:     "SELECT COUNT(*) v FROM usuarios",
    total_agendamentos: "SELECT COUNT(*) v FROM agendamentos",
    agendamentos_hoje:  "SELECT COUNT(*) v FROM agendamentos WHERE data=CURDATE()",
    novos_hoje:         "SELECT COUNT(*) v FROM usuarios WHERE DATE(criado_em)=CURDATE()"
  };
  const stats = {}; let done = 0; const keys = Object.keys(qs);
  keys.forEach(k => db.query(qs[k], (err, rows) => {
    stats[k] = err ? 0 : rows[0].v;
    if (++done === keys.length) res.json(stats);
  }));
});

/* ═══════════════ ADMIN — USUÁRIOS ═══════════════ */
app.get("/admin/usuarios", adminAuth, (req, res) => {
  db.query("SELECT id,nome,sobrenome,email,telefone,nascimento,criado_em FROM usuarios ORDER BY criado_em DESC",
    (err,rows) => err ? res.status(500).json({erro:"Erro."}) : res.json(rows));
});

app.get("/admin/usuarios/:id", adminAuth, (req, res) => {
  db.query("SELECT id,nome,sobrenome,email,telefone,nascimento FROM usuarios WHERE id=?", [req.params.id], (err,rows) =>
    (!rows||!rows.length) ? res.status(404).json({erro:"Não encontrado."}) : res.json(rows[0])
  );
});

app.put("/admin/usuarios/:id", adminAuth, (req, res) => {
  const { nome, sobrenome, email, telefone, nascimento } = req.body;
  db.query("UPDATE usuarios SET nome=?,sobrenome=?,email=?,telefone=?,nascimento=? WHERE id=?",
    [nome, sobrenome||"", email, telefone||"", nascimento||null, req.params.id],
    (err, r) => {
      if (err) return res.status(500).json({erro:"Erro ao atualizar."});
      if (!r.affectedRows) return res.status(404).json({erro:"Não encontrado."});
      res.json({sucesso:true, mensagem:"Usuário atualizado!"});
    }
  );
});

app.put("/admin/usuarios/:id/senha", adminAuth, (req, res) => {
  const { nova_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) return res.status(400).json({erro:"Mínimo 6 caracteres."});
  db.query("UPDATE usuarios SET senha=? WHERE id=?", [hash(nova_senha), req.params.id],
    err => err ? res.status(500).json({erro:"Erro."}) : res.json({sucesso:true,mensagem:"Senha redefinida!"})
  );
});

app.delete("/admin/usuarios/:id", adminAuth, (req, res) => {
  db.query("DELETE FROM usuarios WHERE id=?", [req.params.id],
    err => err ? res.status(500).json({erro:"Erro."}) : res.json({sucesso:true})
  );
});

/* ═══════════════ ADMIN — AGENDAMENTOS ═══════════════ */
app.get("/admin/agendamentos", adminAuth, (req, res) => {
  db.query("SELECT * FROM agendamentos ORDER BY data DESC,horario ASC",
    (err,rows) => err ? res.status(500).json({erro:"Erro."}) : res.json(rows));
});

app.delete("/admin/agendamentos/:id", adminAuth, (req, res) => {
  db.query("DELETE FROM agendamentos WHERE id=?", [req.params.id],
    err => err ? res.status(500).json({erro:"Erro."}) : res.json({sucesso:true})
  );
});

/* ═══════════════ ADMIN — CONTEÚDO DO SITE ═══════════════ */
// Salva conteúdo editável em arquivo JSON local
const fs = require("fs");
const CONTENT_FILE = "./site_content.json";

function lerConteudo() {
  try { return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8")); }
  catch { return {}; }
}

app.get("/admin/conteudo", adminAuth, (req, res) => {
  res.json(lerConteudo());
});

app.put("/admin/conteudo", adminAuth, (req, res) => {
  try {
    const atual = lerConteudo();
    const novo  = Object.assign(atual, req.body);
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(novo, null, 2), "utf8");
    res.json({ sucesso: true, mensagem: "Conteúdo salvo!" });
  } catch(e) {
    res.status(500).json({ erro: "Erro ao salvar conteúdo." });
  }
});

// Rota pública — frontend lê para aplicar conteúdo dinâmico
app.get("/conteudo", (req, res) => {
  res.json(lerConteudo());
});

app.listen(3000, () => console.log("🏖️  http://localhost:3000"));
