const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    // 1. Validar token com Google
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    const userData = response.data;

    // 2. Dados do usuário
    const user = {
      googleId: userData.sub,
      email: userData.email,
      name: userData.name,
      picture: userData.picture
    };

    // 3. Salvar no banco (simulação)
    let existingUser = fakeDatabase.find(u => u.googleId === user.googleId);

    if (!existingUser) {
      fakeDatabase.push(user);
      existingUser = user;
    }

    // 4. Criar sessão (simples)
    res.json({
      message: 'Login realizado',
      user: existingUser
    });

  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

const fakeDatabase = [];

app.listen(3000, () => console.log('Servidor rodando'));