const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'reclutamiento';
const ADMIN_PIN = process.env.ADMIN_PIN || 'Beta.090807';
const FF_USERUID = process.env.FF_USERUID;
const FF_APIKEY = process.env.FF_APIKEY;

let db;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Conectado a MongoDB');
}

// Guardar una nueva postulación
app.post('/api/postulaciones', async (req, res) => {
  try {
    const data = req.body;

    if (!data.nombreReal || !data.apodo || !data.uid || !data.telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const postulacion = {
      nombreReal: data.nombreReal,
      apodo: data.apodo,
      uid: data.uid,
      telefono: data.telefono,
      brRankPoint: data.brRankPoint || 0,
      csRankPoint: data.csRankPoint || 0,
      tasaHeadshot: data.tasaHeadshot || 0,
      experienciaTorneos: data.experienciaTorneos || '',
      experienciaPvp: data.experienciaPvp || '',
      puntajeFinal: data.puntajeFinal || 0,
      estado: 'pendiente',
      fecha: new Date()
    };

    const result = await db.collection('postulaciones').insertOne(postulacion);
    res.json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la postulación.' });
  }
});

// Ver todas las postulaciones (para el admin)
app.get('/api/postulaciones', async (req, res) => {
  try {
    const lista = await db.collection('postulaciones')
      .find({})
      .sort({ puntajeFinal: -1 })
      .toArray();
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener postulaciones.' });
  }
});

// Cambiar estado (aceptado/rechazado) de una postulación
app.patch('/api/postulaciones/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { estado } = req.body;
    await db.collection('postulaciones').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { estado } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar.' });
  }
});

// Verificar PIN de admin (sin exponer el PIN en el frontend)
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'PIN incorrecto.' });
  }
});

// Proxy seguro hacia la API de Free Fire (oculta las claves)
app.get('/api/freefire', async (req, res) => {
  try {
    const { uid, region } = req.query;
    if (!uid || !region) {
      return res.status(400).json({ error: 'Faltan uid o region.' });
    }

    const url = `https://proapis.hlgamingofficial.com/main/games/freefire/account/api?sectionName=AllData&PlayerUid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}&useruid=${encodeURIComponent(FF_USERUID)}&api=${encodeURIComponent(FF_APIKEY)}`;

    const ffRes = await fetch(url);
    const data = await ffRes.json();
    res.status(ffRes.status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar Free Fire API.' });
  }
});

app.get('/', (req, res) => {
  res.send('Backend de reclutamiento funcionando.');
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}).catch(err => {
  console.error('Error al conectar a MongoDB:', err);
});
