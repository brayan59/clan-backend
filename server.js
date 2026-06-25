const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'reclutamiento';
const FF_USERUID = process.env.FF_USERUID;
const FF_APIKEY = process.env.FF_APIKEY;

// Credenciales del superadmin inicial (se crea solo si no existe ningún admin)
const SUPERADMIN_USER = process.env.SUPERADMIN_USER || 'admin';
const SUPERADMIN_PASS = process.env.SUPERADMIN_PASS || 'cambia-esta-clave';

let db;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Conectado a MongoDB');

  // Crear el superadmin inicial si no existe ningún admin todavía
  const count = await db.collection('admins').countDocuments();
  if (count === 0) {
    await db.collection('admins').insertOne({
      username: SUPERADMIN_USER,
      password: SUPERADMIN_PASS,
      role: 'superadmin',
      fecha: new Date()
    });
    console.log('Superadmin inicial creado:', SUPERADMIN_USER);
  }
}

// Middleware: valida usuario/contraseña en cada petición protegida
async function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const username = req.header('x-admin-user');
      const password = req.header('x-admin-pass');
      if (!username || !password) {
        return res.status(401).json({ error: 'Faltan credenciales.' });
      }
      const admin = await db.collection('admins').findOne({ username, password });
      if (!admin) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      }
      if (roles && !roles.includes(admin.role)) {
        return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      req.admin = admin;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error de autenticación.' });
    }
  };
}

// ---------- LOGIN ----------
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await db.collection('admins').findOne({ username, password });
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos.' });
    }
    res.json({ success: true, role: admin.role, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// ---------- GESTIÓN DE ADMINS (solo superadmin) ----------
app.get('/api/admin/list', async (req, res, next) => {
  (await requireAuth(['superadmin']))(req, res, async () => {
    const lista = await db.collection('admins')
      .find({}, { projection: { password: 0 } })
      .toArray();
    res.json(lista);
  });
});

app.post('/api/admin/create', async (req, res) => {
  (await requireAuth(['superadmin']))(req, res, async () => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Faltan usuario o contraseña.' });
      }
      const existe = await db.collection('admins').findOne({ username });
      if (existe) {
        return res.status(400).json({ error: 'Ese usuario ya existe.' });
      }
      await db.collection('admins').insertOne({
        username, password, role: 'admin', fecha: new Date()
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al crear admin.' });
    }
  });
});

app.delete('/api/admin/:id', async (req, res) => {
  (await requireAuth(['superadmin']))(req, res, async () => {
    try {
      const target = await db.collection('admins').findOne({ _id: new ObjectId(req.params.id) });
      if (target && target.role === 'superadmin') {
        return res.status(400).json({ error: 'No puedes eliminar al superadmin.' });
      }
      await db.collection('admins').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar admin.' });
    }
  });
});

// ---------- POSTULACIONES ----------

// Crear postulación (público, sin auth)
app.post('/api/postulaciones', async (req, res) => {
  try {
    const data = req.body;
    if (!data.uid || !data.telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const postulacion = {
      nombreReal: data.nombreReal || '(no proporcionado)',
      apodo: data.apodo || '(no proporcionado)',
      uid: data.uid,
      region: data.region || '',
      telefono: data.telefono,
      nombreFF: data.nombreFF || '',
      nivelFF: data.nivelFF || '',
      brRankPoint: data.brRankPoint || 0,
      csRankPoint: data.csRankPoint || 0,
      cambioNombre: data.cambioNombre || '',
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

// Ver todas las postulaciones (cualquier admin autenticado)
app.get('/api/postulaciones', async (req, res) => {
  (await requireAuth(['admin', 'superadmin']))(req, res, async () => {
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
});

// Cambiar estado (aceptado/rechazado) - cualquier admin
app.patch('/api/postulaciones/:id', async (req, res) => {
  (await requireAuth(['admin', 'superadmin']))(req, res, async () => {
    try {
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
});

// Editar cualquier campo - SOLO superadmin
app.put('/api/postulaciones/:id', async (req, res) => {
  (await requireAuth(['superadmin']))(req, res, async () => {
    try {
      const cambios = { ...req.body };
      delete cambios._id;
      await db.collection('postulaciones').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: cambios }
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al editar.' });
    }
  });
});

// Eliminar postulación - SOLO superadmin
app.delete('/api/postulaciones/:id', async (req, res) => {
  (await requireAuth(['superadmin']))(req, res, async () => {
    try {
      await db.collection('postulaciones').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar.' });
    }
  });
});

// ---------- PROXY FREE FIRE ----------
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
