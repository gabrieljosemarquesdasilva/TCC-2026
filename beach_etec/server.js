require('dotenv').config();
const express  = require("express");
const { Pool } = require("pg");
const cors     = require("cors");
const crypto   = require("crypto");
const fs       = require("fs");
const multer   = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(__dirname));

// ── Banco de dados ──
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
db.connect(err => {
  if (err) console.error("Erro ao conectar:", err.message);
  else     console.log("✅ Conectado ao Supabase!");
});

// ── Supabase Storage ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const BUCKET = "quadras";
const BUCKET_AVATARS = "avatars";

// XP necessário para cada nível: 100xp por nível (nível mínimo = 1)
function calcularNivel(xp) {
  const nivel = Math.floor((xp || 0) / 100) + 1;
  const xpNoNivel = (xp || 0) % 100;
  return { nivel, xpNoNivel, xpProxNivel: 100 };
}

// Concede XP para reservas confirmadas cujo horário já passou e ainda não deram XP.
// 30 XP por hora de quadra jogada. Roda "sob demanda" quando o usuário consulta perfil/agendamentos.
async function concederXpPendente(usuarioId) {
  try {
    const r = await db.query(
      `SELECT id, duracao FROM agendamentos
       WHERE usuario_id=$1 AND status='confirmado' AND xp_concedido=false
         AND (data + horario + (duracao || ' hours')::interval) < NOW()`,
      [usuarioId]
    );
    if (!r.rows.length) return;
    let xpGanho = 0;
    for (const row of r.rows) xpGanho += (row.duracao || 1) * 30;
    const ids = r.rows.map(row => row.id);
    await db.query("UPDATE agendamentos SET xp_concedido=true WHERE id = ANY($1::int[])", [ids]);
    await db.query("UPDATE usuarios SET xp = COALESCE(xp,0) + $1 WHERE id=$2", [xpGanho, usuarioId]);
  } catch (e) { console.error("Erro ao conceder XP:", e.message); }
}

// Multer — armazena em memória para repassar ao Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Apenas imagens são permitidas."));
  }
});

const hash = str => crypto.createHash("sha256").update(str).digest("hex");

/* ═══ USUÁRIOS ═══ */
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
      "SELECT id,nome,sobrenome,email,telefone,nascimento,foto_url,xp,nivel_jogo FROM usuarios WHERE email=$1 AND senha=$2",
      [email, hash(senha)]
    );
    if (!r.rows.length) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    const u = r.rows[0];
    await concederXpPendente(u.id);
    const xpAtual = await db.query("SELECT xp FROM usuarios WHERE id=$1", [u.id]);
    const { nivel, xpNoNivel, xpProxNivel } = calcularNivel(xpAtual.rows[0].xp);
    const adm = await db.query("SELECT id FROM admins WHERE email=$1", [email]);
    const isAdmin = adm.rows.length > 0;
    const token = crypto.randomBytes(32).toString("hex");
    await db.query("INSERT INTO usuario_sessoes(token,usuario_id) VALUES($1,$2)", [token, u.id]);
    res.json({ sucesso: true, isAdmin, token, usuario: {
      id: u.id, nome: u.nome+(u.sobrenome?" "+u.sobrenome:""),
      email: u.email, foto: u.foto_url || null,
      telefone: u.telefone||"", nascimento: u.nascimento||"",
      nivel_jogo: u.nivel_jogo||"", xp: xpAtual.rows[0].xp||0, nivel, xpNoNivel, xpProxNivel
    }});
  } catch(e) { res.status(500).json({ erro: "Erro interno." }); }
});

app.post("/login-google", async (req, res) => {
  const { google_id, nome, email, foto } = req.body;

  if (!google_id || !email) {
    return res.status(400).json({
      erro: "Google ID e e-mail são obrigatórios."
    });
  }

  try {
    // Verifica se já existe pelo e-mail
    let r = await db.query(
      `SELECT id, nome, sobrenome, email, telefone, nascimento,
              foto_url, xp, nivel_jogo
       FROM usuarios
       WHERE email=$1`,
      [email]
    );

    let usuario;

    if (r.rows.length) {

      // Usuário já existe
      usuario = r.rows[0];

      // Atualiza nome/foto caso tenham mudado no Google
      await db.query(
        `UPDATE usuarios
         SET nome=$1,
             foto_url=COALESCE($2, foto_url)
         WHERE id=$3`,
        [
          nome || usuario.nome,
          foto || usuario.foto_url,
          usuario.id
        ]
      );

    } else {

      // Se não existe, cria novo usuário
      r = await db.query(
        `INSERT INTO usuarios
         (nome, sobrenome, email, telefone, senha, nascimento, foto_url, xp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, nome, sobrenome, email, telefone,
                   nascimento, foto_url, xp, nivel_jogo`,
        [
          nome || "Usuário",
          "",
          email,
          "",
          null,
          null,
          foto || null,
          0
        ]
      );

      usuario = r.rows[0];
    }

    // Garante que o XP esteja atualizado
    await concederXpPendente(usuario.id);

    const xpAtual = await db.query(
      "SELECT xp FROM usuarios WHERE id=$1",
      [usuario.id]
    );

    const { nivel, xpNoNivel, xpProxNivel } =
      calcularNivel(xpAtual.rows[0].xp);

    // Verifica se é administrador
    const adm = await db.query(
      "SELECT id FROM admins WHERE email=$1",
      [email]
    );

    const isAdmin = adm.rows.length > 0;

    // Cria sessão
    const token = crypto.randomBytes(32).toString("hex");

    await db.query(
      `INSERT INTO usuario_sessoes(token, usuario_id)
       VALUES($1,$2)`,
      [token, usuario.id]
    );

    res.json({
      sucesso: true,
      isAdmin,
      token,

      usuario: {
        id: usuario.id,

        nome: usuario.nome +
          (usuario.sobrenome ? " " + usuario.sobrenome : ""),

        email: usuario.email,

        foto: usuario.foto_url || null,

        telefone: usuario.telefone || "",

        nascimento: usuario.nascimento || "",

        nivel_jogo: usuario.nivel_jogo || "",

        xp: xpAtual.rows[0].xp || 0,

        nivel,

        xpNoNivel,

        xpProxNivel
      }
    });

  } catch (e) {

    console.error("Erro no login Google:", e);

    res.status(500).json({
      erro: "Erro ao realizar login com Google."
    });
  }
});

/* ═══ PERFIL ═══ */

// Dados atualizados do usuário logado (foto, XP, nível)
app.get("/perfil", userAuth, async (req, res) => {
  try {
    await concederXpPendente(req.usuarioId);
    const r = await db.query(
      "SELECT id,nome,sobrenome,email,telefone,nascimento,foto_url,xp,nivel_jogo FROM usuarios WHERE id=$1",
      [req.usuarioId]
    );
    if (!r.rows.length) return res.status(404).json({ erro: "Usuário não encontrado." });
    const u = r.rows[0];
    const { nivel, xpNoNivel, xpProxNivel } = calcularNivel(u.xp);
    res.json({
      id: u.id, nome: u.nome+(u.sobrenome?" "+u.sobrenome:""), email: u.email,
      telefone: u.telefone||"", nascimento: u.nascimento||"", foto: u.foto_url||null,
      nivel_jogo: u.nivel_jogo||"", xp: u.xp||0, nivel, xpNoNivel, xpProxNivel
    });
  } catch(e) { res.status(500).json({ erro: "Erro ao buscar perfil." }); }
});

// Salvar nível de jogo (auto-avaliado pelo jogador)
app.put("/perfil/nivel-jogo", userAuth, async (req, res) => {
  const { nivel_jogo } = req.body;
  try {
    await db.query("UPDATE usuarios SET nivel_jogo=$1 WHERE id=$2", [nivel_jogo||"", req.usuarioId]);
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar nível." }); }
});

// Upload de foto de perfil — salva no Supabase Storage e grava a URL no banco
app.post("/perfil/foto", userAuth, upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhuma imagem enviada." });
    const ext      = req.file.mimetype.split("/")[1].replace("jpeg","jpg");
    const filename = `usuario_${req.usuarioId}_${Date.now()}.${ext}`;
    const path     = `perfil/${filename}`;

    const { error } = await supabase.storage.from(BUCKET_AVATARS).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });
    if (error) return res.status(500).json({ erro: "Erro no upload: " + error.message });

    const { data: urlData } = supabase.storage.from(BUCKET_AVATARS).getPublicUrl(path);
    const url = urlData.publicUrl;

    await db.query("UPDATE usuarios SET foto_url=$1 WHERE id=$2", [url, req.usuarioId]);
    res.json({ sucesso: true, foto: url });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar foto." }); }
});

/* ═══ AGENDAMENTOS ═══ */
app.get("/horarios-disponiveis", async (req, res) => {
  const { data, quadra } = req.query;
  if (!data || !quadra) return res.status(400).json({ erro: "Data e quadra obrigatórios." });
  try {
    const r = await db.query("SELECT horario FROM agendamentos WHERE data=$1 AND quadra=$2", [data, quadra]);
    res.json({ ocupados: r.rows.map(row => String(row.horario).substring(0, 5)) });
  } catch(e) { res.status(500).json({ erro: "Erro ao consultar." }); }
});

const HORARIO_ABERTURA = 7, HORARIO_FECHAMENTO = 22; // quadras funcionam das 07h às 21h (última entrada)

function horasDaReserva(horarioInicio, duracaoHoras) {
  const horaBase = parseInt(String(horarioInicio).split(":")[0], 10);
  const horas = [];
  for (let i = 0; i < duracaoHoras; i++) horas.push(String(horaBase + i).padStart(2, "0") + ":00");
  return horas;
}

app.post("/agendar", userAuth, async (req, res) => {
  const { nome, quadra, data, horario, modalidade, nivel } = req.body;
  const duracao = Math.max(1, Math.min(4, parseInt(req.body.duracao, 10) || 1));
  try {
    const horas = horasDaReserva(horario, duracao);
    const ultimaHora = parseInt(horas[horas.length - 1].split(":")[0], 10);
    if (ultimaHora >= HORARIO_FECHAMENTO) {
      return res.status(400).json({ erro: "A duração escolhida ultrapassa o horário de funcionamento da quadra." });
    }

    // Verifica se algum dos horários necessários já está ocupado (reservas de 1h ocupam 1 linha cada)
    const conflito = await db.query(
      "SELECT horario FROM agendamentos WHERE quadra=$1 AND data=$2 AND horario = ANY($3::time[]) AND status!='cancelado'",
      [quadra, data, horas]
    );
    if (conflito.rows.length) {
      return res.status(409).json({ erro: "Um ou mais horários necessários para essa duração já estão ocupados." });
    }

    const grupoId = crypto.randomBytes(8).toString("hex");
    for (const h of horas) {
      await db.query(
        "INSERT INTO agendamentos(nome,quadra,data,horario,modalidade,nivel,status,usuario_id,duracao,grupo_id) VALUES($1,$2,$3,$4,$5,$6,'pendente',$7,$8,$9)",
        [nome, quadra, data, h, modalidade, nivel, req.usuarioId, duracao, grupoId]
      );
    }
    res.json({ sucesso: true, mensagem: "Agendado! ✅" });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar." }); }
});

app.get("/agendamentos", userAuth, async (req, res) => {
  try {
    await concederXpPendente(req.usuarioId);
    const r = await db.query("SELECT * FROM agendamentos WHERE usuario_id=$1 ORDER BY data DESC, horario ASC", [req.usuarioId]);
    // Agrupa as linhas de hora-em-hora de uma mesma reserva (grupo_id) em um único item
    const grupos = new Map();
    for (const row of r.rows) {
      const chave = row.grupo_id || ("solo_" + row.id);
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: row.id, grupo_id: row.grupo_id, nome: row.nome, quadra: row.quadra,
          data: row.data, horario_inicio: String(row.horario).substring(0,5),
          horario_fim: null, modalidade: row.modalidade, nivel: row.nivel,
          status: row.status, duracao: row.duracao||1, ids: [row.id]
        });
      } else {
        grupos.get(chave).ids.push(row.id);
      }
    }
    const resultado = Array.from(grupos.values()).map(g => {
      const horaFim = parseInt(g.horario_inicio.split(":")[0],10) + g.duracao;
      g.horario_fim = String(horaFim).padStart(2,"0") + ":00";
      return g;
    });
    res.json(resultado);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.delete("/agendamentos/:id", userAuth, async (req, res) => {
  try {
    // Cancela todas as linhas do mesmo grupo (reserva de múltiplas horas), se houver
    const alvo = await db.query("SELECT grupo_id FROM agendamentos WHERE id=$1 AND usuario_id=$2", [req.params.id, req.usuarioId]);
    if (!alvo.rows.length) return res.status(404).json({ erro: "Agendamento não encontrado ou sem permissão." });
    const grupoId = alvo.rows[0].grupo_id;
    let r;
    if (grupoId) {
      r = await db.query("DELETE FROM agendamentos WHERE grupo_id=$1 AND usuario_id=$2 RETURNING id", [grupoId, req.usuarioId]);
    } else {
      r = await db.query("DELETE FROM agendamentos WHERE id=$1 AND usuario_id=$2 RETURNING id", [req.params.id, req.usuarioId]);
    }
    if (!r.rows.length) return res.status(404).json({ erro: "Agendamento não encontrado ou sem permissão." });
    res.json({ sucesso: true, mensagem: "Reserva cancelada." });
  } catch(e) { res.status(500).json({ erro: "Erro ao cancelar." }); }
});

/* ═══ QUADRAS — rotas públicas ═══ */

// Lista todas as quadras com fotos
app.get("/quadras", async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM quadras ORDER BY ordem ASC");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro ao buscar quadras." }); }
});

/* ═══ ADMIN AUTH ═══ */
app.post("/admin/auth-user", async (req, res) => {
  const userToken = req.headers["x-user-token"];
  if (!userToken) return res.status(401).json({ erro: "Não autenticado." });
  try {
    const sess = await db.query(
      "SELECT u.id, u.nome, u.email FROM usuario_sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token=$1",
      [userToken]
    );
    if (!sess.rows.length) return res.status(401).json({ erro: "Sessão inválida." });
    const u = sess.rows[0];
    const adm = await db.query("SELECT id FROM admins WHERE email=$1", [u.email]);
    if (!adm.rows.length) return res.status(403).json({ erro: "Acesso negado." });
    const adminToken = crypto.randomBytes(32).toString("hex");
    await db.query("INSERT INTO admin_sessoes(token,admin_id) VALUES($1,$2)", [adminToken, adm.rows[0].id]);
    res.json({ sucesso: true, token: adminToken, admin: u.nome });
  } catch(e) { res.status(500).json({ erro: "Erro interno." }); }
});

app.post("/admin/auth", async (req, res) => {
  const { usuario, senha } = req.body;
  try {
    const r = await db.query("SELECT id,usuario FROM admins WHERE usuario=$1 AND senha=$2", [usuario, hash(senha)]);
    if (!r.rows.length) return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    const token = crypto.randomBytes(32).toString("hex");
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

/* ═══ ADMIN — STATS ═══ */
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

/* ═══ ADMIN — USUÁRIOS ═══ */
app.get("/admin/usuarios", adminAuth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT u.id,u.nome,u.sobrenome,u.email,u.telefone,u.nascimento,u.criado_em,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END as is_admin
      FROM usuarios u LEFT JOIN admins a ON u.email = a.email
      ORDER BY u.criado_em DESC
    `);
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

/* ═══ ADMIN — AGENDAMENTOS ═══ */
app.get("/admin/agendamentos", adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = "SELECT * FROM agendamentos";
    let params = [];
    if (status) { query += " WHERE status=$1"; params.push(status); }
    query += " ORDER BY data DESC, horario ASC";
    const r = await db.query(query, params);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/admin/agendamentos/:id/status", adminAuth, async (req, res) => {
  const { status } = req.body;
  if (!['pendente','confirmado','cancelado'].includes(status)) return res.status(400).json({ erro: "Status inválido." });
  try {
    const r = await db.query("UPDATE agendamentos SET status=$1 WHERE id=$2 RETURNING id", [status, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: "Agendamento não encontrado." });
    res.json({ sucesso: true, mensagem: "Status atualizado!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao atualizar." }); }
});

app.delete("/admin/agendamentos/:id", adminAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM agendamentos WHERE id=$1", [req.params.id]);
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

/* ═══ ADMIN — QUADRAS ═══ */

// Listar quadras (admin)
app.get("/admin/quadras", adminAuth, async (req, res) => {
  try {
    const r = await db.query("SELECT * FROM quadras ORDER BY ordem ASC");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ erro: "Erro." }); }
});

// Criar nova quadra
app.post("/admin/quadras", adminAuth, async (req, res) => {
  const { nome, descricao, badges, endereco, capacidade, funcionamento, piso } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome obrigatório." });
  try {
    const maxOrdem = await db.query("SELECT COALESCE(MAX(ordem),0) v FROM quadras");
    const ordem = parseInt(maxOrdem.rows[0].v) + 1;
    const r = await db.query(
      "INSERT INTO quadras(nome,descricao,badges,ordem,fotos,endereco,capacidade,funcionamento,piso) VALUES($1,$2,$3,$4,'[]',$5,$6,$7,$8) RETURNING *",
      [nome, descricao||"", JSON.stringify(badges||[]), ordem, endereco||"", capacidade||null, funcionamento||"", piso||""]
    );
    res.json({ sucesso: true, quadra: r.rows[0] });
  } catch(e) { res.status(500).json({ erro: "Erro ao criar quadra." }); }
});

// Atualizar nome/descrição/badges
app.put("/admin/quadras/:id", adminAuth, async (req, res) => {
  const { nome, descricao, badges, endereco, capacidade, funcionamento, piso } = req.body;
  try {
    const r = await db.query(
      "UPDATE quadras SET nome=$1, descricao=$2, badges=$3, endereco=$4, capacidade=$5, funcionamento=$6, piso=$7 WHERE id=$8 RETURNING *",
      [nome, descricao||"", JSON.stringify(badges||[]), endereco||"", capacidade||null, funcionamento||"", piso||"", req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ erro: "Quadra não encontrada." });
    res.json({ sucesso: true, quadra: r.rows[0] });
  } catch(e) { res.status(500).json({ erro: "Erro ao atualizar." }); }
});

// Deletar quadra (e todas as fotos do Supabase Storage)
app.delete("/admin/quadras/:id", adminAuth, async (req, res) => {
  try {
    const r = await db.query("SELECT fotos FROM quadras WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: "Quadra não encontrada." });
    const fotos = r.rows[0].fotos || [];
    // Deletar fotos do Storage
    if (fotos.length) {
      const paths = fotos.map(f => f.path);
      await supabase.storage.from(BUCKET).remove(paths);
    }
    await db.query("DELETE FROM quadras WHERE id=$1", [req.params.id]);
    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro ao deletar quadra." }); }
});

// Upload de foto para uma quadra
app.post("/admin/quadras/:id/fotos", adminAuth, upload.single("foto"), async (req, res) => {
  try {
    const r = await db.query("SELECT fotos FROM quadras WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: "Quadra não encontrada." });

    const ext      = req.file.mimetype.split("/")[1].replace("jpeg","jpg");
    const filename = `quadra_${req.params.id}_${Date.now()}.${ext}`;
    const path     = `quadra${req.params.id}/${filename}`;

    // Upload para Supabase Storage
    const { error } = await supabase.storage.from(BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });
    if (error) return res.status(500).json({ erro: "Erro no upload: " + error.message });

    // URL pública
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = urlData.publicUrl;

    // Salvar no banco
    const fotos = r.rows[0].fotos || [];
    fotos.push({ path, url });
    await db.query("UPDATE quadras SET fotos=$1 WHERE id=$2", [JSON.stringify(fotos), req.params.id]);

    res.json({ sucesso: true, foto: { path, url } });
  } catch(e) { res.status(500).json({ erro: "Erro ao fazer upload." }); }
});

// Deletar foto de uma quadra
app.delete("/admin/quadras/:id/fotos", adminAuth, async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ erro: "Path obrigatório." });
  try {
    const r = await db.query("SELECT fotos FROM quadras WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: "Quadra não encontrada." });

    // Remover do Storage
    await supabase.storage.from(BUCKET).remove([path]);

    // Atualizar banco
    const fotos = (r.rows[0].fotos || []).filter(f => f.path !== path);
    await db.query("UPDATE quadras SET fotos=$1 WHERE id=$2", [JSON.stringify(fotos), req.params.id]);

    res.json({ sucesso: true });
  } catch(e) { res.status(500).json({ erro: "Erro ao deletar foto." }); }
});

/* ═══ ADMIN — CONTEÚDO + HISTÓRICO ═══ */
const CONTENT_FILE = "./site_content.json";
const HISTORY_FILE = "./site_content_history.json";
const DEFAULT_FILE = "./site_content_default.json";

function lerJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return file === HISTORY_FILE ? [] : {}; }
}
function salvarJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8"); }
if (!fs.existsSync(DEFAULT_FILE)) salvarJSON(DEFAULT_FILE, lerJSON(CONTENT_FILE));

app.get("/admin/conteudo", adminAuth, (req, res) => res.json(lerJSON(CONTENT_FILE)));

app.put("/admin/conteudo", adminAuth, (req, res) => {
  try {
    const atual = lerJSON(CONTENT_FILE);
    const novo  = Object.assign({}, atual, req.body);
    const hist  = lerJSON(HISTORY_FILE);
    hist.unshift({ id: Date.now(), timestamp: new Date().toISOString(), secao: req.body._secao||"Geral", snapshot: atual });
    if (hist.length > 50) hist.splice(50);
    salvarJSON(HISTORY_FILE, hist);
    salvarJSON(CONTENT_FILE, novo);
    res.json({ sucesso: true, mensagem: "Conteúdo salvo!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao salvar conteúdo." }); }
});

app.get("/admin/conteudo/historico", adminAuth, (req, res) => {
  const hist = lerJSON(HISTORY_FILE);
  res.json(hist.map(h => ({ id: h.id, timestamp: h.timestamp, secao: h.secao, preview: JSON.stringify(h.snapshot).substring(0, 120) + "..." })));
});

app.post("/admin/conteudo/rollback/:id", adminAuth, (req, res) => {
  try {
    const hist  = lerJSON(HISTORY_FILE);
    const entry = hist.find(h => String(h.id) === String(req.params.id));
    if (!entry) return res.status(404).json({ erro: "Entrada não encontrada." });
    const atual = lerJSON(CONTENT_FILE);
    hist.unshift({ id: Date.now(), timestamp: new Date().toISOString(), secao: "Rollback automático", snapshot: atual });
    salvarJSON(HISTORY_FILE, hist);
    salvarJSON(CONTENT_FILE, entry.snapshot);
    res.json({ sucesso: true, mensagem: "Conteúdo restaurado!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao restaurar." }); }
});

app.post("/admin/conteudo/restaurar-padrao", adminAuth, (req, res) => {
  try {
    const padrao = lerJSON(DEFAULT_FILE);
    if (!Object.keys(padrao).length) return res.status(404).json({ erro: "Padrão não encontrado." });
    const atual = lerJSON(CONTENT_FILE);
    const hist  = lerJSON(HISTORY_FILE);
    hist.unshift({ id: Date.now(), timestamp: new Date().toISOString(), secao: "Restauração para padrão", snapshot: atual });
    salvarJSON(HISTORY_FILE, hist);
    salvarJSON(CONTENT_FILE, padrao);
    res.json({ sucesso: true, mensagem: "Padrão restaurado!" });
  } catch(e) { res.status(500).json({ erro: "Erro ao restaurar padrão." }); }
});

app.get("/conteudo", (req, res) => res.json(lerJSON(CONTENT_FILE)));

// ═══ 404 personalizada ═══
app.use((req, res) => {
  if (req.accepts("html")) return res.status(404).sendFile(__dirname + "/404.html");
  res.status(404).json({ erro: "Rota não encontrada." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🏖️  Servidor rodando na porta ${PORT}`));

// ==========================================
// VERIFICAR DADOS COMPLEMENTARES DO USUÁRIO
// ==========================================
app.get('/usuario/me', userAuth, async (req, res) => {
  try {

    const result = await db.query(
      `SELECT
        id,
        email,
        nome,
        sobrenome,
        foto_url,
        telefone,
        nascimento,
        nivel_jogo,
        xp
       FROM usuarios
       WHERE id = $1`,
      [req.usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Usuário não encontrado.'
      });
    }

    const usuario = result.rows[0];

    res.json({
      sucesso: true,

      usuario: {
        id: usuario.id,

        nome: usuario.nome +
          (usuario.sobrenome
            ? " " + usuario.sobrenome
            : ""),

        email: usuario.email,

        foto: usuario.foto_url || null,

        telefone: usuario.telefone || "",

        nascimento: usuario.nascimento || "",

        nivel_jogo: usuario.nivel_jogo || "",

        xp: usuario.xp || 0
      },

      dadosCompletos:
        !!usuario.telefone &&
        !!usuario.nascimento
    });

  } catch (error) {

    console.error(
      'Erro ao buscar usuário:',
      error
    );

    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao buscar dados do usuário.'
    });
  }
});

// ==========================================
// ATUALIZAR TELEFONE E DATA DE NASCIMENTO
// ==========================================
app.put('/usuario/dados-complementares', userAuth, async (req, res) => {
  try {

    const {
      telefone,
      data_nascimento
    } = req.body;

    if (!telefone || !data_nascimento) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Telefone e data de nascimento são obrigatórios.'
      });
    }

    await db.query(
      `UPDATE usuarios
       SET telefone = $1,
           nascimento = $2
       WHERE id = $3`,
      [
        telefone,
        data_nascimento,
        req.usuarioId
      ]
    );

    res.json({
      sucesso: true,
      mensagem: 'Dados atualizados com sucesso.'
    });

  } catch (error) {

    console.error(
      'Erro ao atualizar dados:',
      error
    );

    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao atualizar seus dados.'
    });
  }
});
