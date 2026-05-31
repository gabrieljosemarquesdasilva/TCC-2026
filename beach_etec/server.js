const express = require("express");
const { Pool } = require("pg");
const cors    = require("cors");
const crypto  = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// ── Conexão Supabase (PostgreSQL) ──────────────────────
const db = new Pool({
  host:     "db.servfjolajkiozwzyjgq.supabase.co",
  port:     5432,
  database: "postgres",
  user:     "postgres",
  password: "SUA_SENHA_AQUI",   // ← troque pela senha do Supabase
  ssl:      { rejectUnauthorized: false }
});

db.connect(err => {
  if (err) console.error("Erro ao conectar:", err.message);
  else     console.log("✅ Conectado ao Supabase!");
});

const hash = str => crypto.createHash("sha256").update(str).digest("hex");

/* ═══════════════ USUÁRIOS ═══════════════ */
app.post("/cadastrar", async (req, res) => {
  const { nome, sobrenome, email, telefone, senha, nascimento } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Nome, e-mail e senha obrigatórios." });
  try {
    const existe = await db.query("SELECT id FROM usuarios WHERE email=$1", [email]);
    if (existe.rows.length) return res.status(409).json({ erro: "E-mail já cadastrado." });
    await db.query(
      "INSERT INTO usuarios (nome,sobrenome,email,telefone,senha,nascimento) VALUES($1,$2,$3,$4,$5,$6)",
      [nome, sobrenome||"", email, telefone||"", hash(senha), nascimento||null]
    );
    res.json({ sucesso: true, mensagem: "Conta criada!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao cadastrar." }); }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha." });
  try {
    const r = await db.query(
      "SELECT id,nome,sobrenome,email FROM usuarios WHERE email=$1 AND senha=$2",
      [email, hash(senha)]
    );
    if (!r.rows.length) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    const u = r.rows[0];
    res.json({ sucesso: true, usuario: { id:u.id, nome:u.nome+(u.sobrenome?" "+u.sobrenome:""), email:u.email, foto:null }});
  } catch(e) { res.status(500).json({ erro: "Erro interno." }); }
});

app.post("/login-google", async (req, res) => {
  const { google_id, nome, email, foto } = req.body;
  try {
    await db.query(
      `INSERT INTO login(google_id,nome,email,foto) VALUES($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET nome=EXCLUDED.nome, email=EXCLUDED.email, foto=EXCLUDED.foto`,
      [google_id, nome, email, foto]
    );
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══════════════ AGENDAMENTOS ═══════════════ */
app.post("/agendar", async (req, res) => {
  const { nome, quadra, data, horario, modalidade, nivel } = req.body;
  try {
    await db.query(
      "INSERT INTO agendamentos(nome,quadra,data,horario,modalidade,nivel) VALUES($1,$2,$3,$4,$5,$6)",
      [nome, quadra, data, horario, modalidade, nivel]
    );
    res.json({ sucesso: true, mensagem: "Agendado! ✅" });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar." }); }
});

app.get("/agendamentos", async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM agendamentos ORDER BY data DESC");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══════════════ ADMIN AUTH ═══════════════ */
app.post("/admin/auth", async (req, res) => {
  const { usuario, senha } = req.body;
  try {
    const r = await db.query("SELECT id,usuario FROM admins WHERE usuario=$1 AND senha=$2", [usuario, hash(senha)]);
    if (!r.rows.length) return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    const token = hash(r.rows[0].id + Date.now() + "beach_etec_2025");
    await db.query("INSERT INTO admin_sessoes(token,admin_id) VALUES($1,$2)", [token, r.rows[0].id]);
    res.json({ sucesso: true, token, admin: r.rows[0].usuario });
  } catch(e) { res.status(500).json({ erro: "Erro interno." }); }
});

app.post("/admin/logout", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token) await db.query("DELETE FROM admin_sessoes WHERE token=$1", [token]).catch(()=>{});
  res.json({ sucesso: true });
});

async function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token) return res.status(401).json({ erro: "Não autorizado." });
  try {
    const r = await db.query("SELECT id FROM admin_sessoes WHERE token=$1", [token]);
    if (!r.rows.length) return res.status(401).json({ erro: "Token inválido." });
    next();
  } catch(e) { res.status(401).json({ erro: "Erro de autenticação." }); }
}

/* ═══════════════ ADMIN — STATS ═══════════════ */
app.get("/admin/stats", adminAuth, async (req, res) => {
  try {
    const [tu, ta, th, nh] = await Promise.all([
      db.query("SELECT COUNT(*) v FROM usuarios"),
      db.query("SELECT COUNT(*) v FROM agendamentos"),
      db.query("SELECT COUNT(*) v FROM agendamentos WHERE data=CURRENT_DATE"),
      db.query("SELECT COUNT(*) v FROM usuarios WHERE criado_em::date=CURRENT_DATE")
    ]);
    res.json({
      total_usuarios:     parseInt(tu.rows[0].v),
      total_agendamentos: parseInt(ta.rows[0].v),
      agendamentos_hoje:  parseInt(th.rows[0].v),
      novos_hoje:         parseInt(nh.rows[0].v)
    });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══════════════ ADMIN — USUÁRIOS ═══════════════ */
app.get("/admin/usuarios", adminAuth, async (req, res) => {
  try {
    const r = await db.query("SELECT id,nome,sobrenome,email,telefone,nascimento,criado_em FROM usuarios ORDER BY criado_em DESC");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/admin/usuarios/:id", adminAuth, async (req, res) => {
  try {
    const r = await db.query("SELECT id,nome,sobrenome,email,telefone,nascimento FROM usuarios WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: "Não encontrado." });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/admin/usuarios/:id", adminAuth, async (req, res) => {
  const { nome, sobrenome, email, telefone, nascimento } = req.body;
  try {
    const r = await db.query(
      "UPDATE usuarios SET nome=$1,sobrenome=$2,email=$3,telefone=$4,nascimento=$5 WHERE id=$6",
      [nome, sobrenome||"", email, telefone||"", nascimento||null, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ erro: "Não encontrado." });
    res.json({ sucesso: true, mensagem: "Usuário atualizado!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao atualizar." }); }
});

app.put("/admin/usuarios/:id/senha", adminAuth, async (req, res) => {
  const { nova_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) return res.status(400).json({ erro: "Mínimo 6 caracteres." });
  try {
    await db.query("UPDATE usuarios SET senha=$1 WHERE id=$2", [hash(nova_senha), req.params.id]);
    res.json({ sucesso: true, mensagem: "Senha redefinida!" });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.delete("/admin/usuarios/:id", adminAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM usuarios WHERE id=$1", [req.params.id]);
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══════════════ ADMIN — AGENDAMENTOS ═══════════════ */
app.get("/admin/agendamentos", adminAuth, async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM agendamentos ORDER BY data DESC, horario ASC");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.delete("/admin/agendamentos/:id", adminAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM agendamentos WHERE id=$1", [req.params.id]);
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══════════════ ADMIN — CONTEÚDO DO SITE ═══════════════ */
const fs = require("fs");
const CONTENT_FILE = "./site_content.json";

function lerConteudo() {
  try { return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8")); }
  catch { return {}; }
}

app.get("/admin/conteudo", adminAuth, (req, res) => res.json(lerConteudo()));

app.put("/admin/conteudo", adminAuth, (req, res) => {
  try {
    const novo = Object.assign(lerConteudo(), req.body);
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(novo, null, 2), "utf8");
    res.json({ sucesso: true, mensagem: "Conteúdo salvo!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar conteúdo." }); }
});

app.get("/conteudo", (req, res) => res.json(lerConteudo()));

/* ═══════════════ INICIAR ═══════════════ */
app.listen(3000, () => console.log("🏖️  Servidor rodando em http://localhost:3000"));