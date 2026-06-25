const BACKEND_URL = "https://clan-backend-cpu4.onrender.com"; // tu URL de Render

let currentUser = null;
let currentRole = null;

function authHeaders(){
  return {
    'Content-Type': 'application/json',
    'x-admin-user': currentUser,
    'x-admin-pass': sessionStorage.getItem('admin_pass') || ''
  };
}

async function login(){
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const loginError = document.getElementById('loginError');
  loginError.textContent = '';

  try{
    const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if(data.success){
      currentUser = data.username;
      currentRole = data.role;
      sessionStorage.setItem('admin_pass', password);

      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('container').style.display = 'block';
      document.getElementById('userTag').textContent = `${data.username} (${data.role})`;

      if(data.role === 'superadmin'){
        document.getElementById('btnGestionAdmins').style.display = 'inline-block';
      }

      cargar();
    } else {
      loginError.textContent = data.error || 'Usuario o contraseña incorrectos.';
    }
  }catch(err){
    loginError.textContent = 'Error al iniciar sesión: ' + err.message;
  }
}

function logout(){
  currentUser = null;
  currentRole = null;
  sessionStorage.removeItem('admin_pass');
  document.getElementById('container').style.display = 'none';
  document.getElementById('loginCard').style.display = 'block';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

async function cargar(){
  try{
    const res = await fetch(`${BACKEND_URL}/api/postulaciones`, { headers: authHeaders() });
    const lista = await res.json();
    if(!Array.isArray(lista)){
      throw new Error(lista.error || 'No se pudo cargar.');
    }
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';

    lista.forEach((p, i) => {
      const tel = (p.telefono || '').replace(/\D/g,'');
      const msg = encodeURIComponent(`¡Hola ${p.nombreReal}! Fuiste aceptado en el clan. Te esperamos hoy a la hora indicada en el juego. Únete al grupo: https://chat.whatsapp.com/Luo7MuQ8p0LLchLJA1CKSN`);

      let accionesExtra = '';
      if(currentRole === 'superadmin'){
        accionesExtra = `
          <button class="btn-editar" onclick="editarPostulacion('${p._id}')">Editar</button>
          <button class="btn-eliminar" onclick="eliminarPostulacion('${p._id}')">Eliminar</button>
        `;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="#">${i+1}</td>
        <td data-label="Nombre">${p.nombreReal}</td>
        <td data-label="Apodo">${p.apodo}</td>
        <td data-label="Género">${p.genero || '-'}</td>
        <td data-label="UID">${p.uid}</td>
        <td data-label="BR pts">${p.brRankPoint}</td>
        <td data-label="CS pts">${p.csRankPoint}</td>
        <td data-label="Cambia nombre">${p.cambioNombre || '-'}</td>
        <td data-label="Torneos">${p.experienciaTorneos}</td>
        <td data-label="PvP">${p.experienciaPvp}</td>
        <td data-label="Puntaje"><strong>${p.puntajeFinal}</strong></td>
        <td data-label="Estado"><span class="badge ${p.estado}">${p.estado}</span></td>
        <td class="actions">
          <button class="btn-aceptar" onclick="cambiarEstado('${p._id}','aceptado')">Aceptar</button>
          <button class="btn-rechazar" onclick="cambiarEstado('${p._id}','rechazado')">Rechazar</button>
          <a href="https://wa.me/${tel}?text=${msg}" target="_blank"><button class="btn-whatsapp">WhatsApp</button></a>
          ${accionesExtra}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }catch(err){
    alert('Error al cargar postulaciones: ' + err.message);
  }
}

async function cambiarEstado(id, estado){
  try{
    await fetch(`${BACKEND_URL}/api/postulaciones/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({estado})
    });
    cargar();
  }catch(err){
    alert('Error al actualizar: ' + err.message);
  }
}

async function eliminarPostulacion(id){
  if(!confirm('¿Seguro que quieres eliminar esta postulación? Esta acción no se puede deshacer.')) return;
  try{
    const res = await fetch(`${BACKEND_URL}/api/postulaciones/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Error al eliminar.');
    cargar();
  }catch(err){
    alert('Error al eliminar: ' + err.message);
  }
}

async function editarPostulacion(id){
  const nuevoNombre = prompt('Editar nombre real:');
  if(nuevoNombre === null) return;
  const nuevoApodo = prompt('Editar apodo:');
  if(nuevoApodo === null) return;
  const nuevoTelefono = prompt('Editar teléfono:');
  if(nuevoTelefono === null) return;

  try{
    const res = await fetch(`${BACKEND_URL}/api/postulaciones/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        nombreReal: nuevoNombre,
        apodo: nuevoApodo,
        telefono: nuevoTelefono
      })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Error al editar.');
    cargar();
  }catch(err){
    alert('Error al editar: ' + err.message);
  }
}

// ---------- GESTIÓN DE ADMINS (solo superadmin) ----------

function abrirGestionAdmins(){
  document.getElementById('modalAdmins').classList.add('active');
  cargarAdmins();
}

function cerrarGestionAdmins(){
  document.getElementById('modalAdmins').classList.remove('active');
}

async function cargarAdmins(){
  try{
    const res = await fetch(`${BACKEND_URL}/api/admin/list`, { headers: authHeaders() });
    const lista = await res.json();
    const tbody = document.getElementById('tbodyAdmins');
    tbody.innerHTML = '';

    lista.forEach(a => {
      const tr = document.createElement('tr');
      const btnEliminar = a.role === 'superadmin'
        ? ''
        : `<button class="btn-eliminar" onclick="eliminarAdmin('${a._id}')">Eliminar</button>`;
      tr.innerHTML = `<td>${a.username}</td><td>${a.role}</td><td>${btnEliminar}</td>`;
      tbody.appendChild(tr);
    });
  }catch(err){
    document.getElementById('adminError').textContent = 'Error al cargar admins: ' + err.message;
  }
}

async function crearAdmin(){
  const username = document.getElementById('newAdminUser').value.trim();
  const password = document.getElementById('newAdminPass').value;
  const adminError = document.getElementById('adminError');
  adminError.textContent = '';

  if(!username || !password){
    adminError.textContent = 'Completa usuario y contraseña.';
    return;
  }

  try{
    const res = await fetch(`${BACKEND_URL}/api/admin/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Error al crear admin.');

    document.getElementById('newAdminUser').value = '';
    document.getElementById('newAdminPass').value = '';
    cargarAdmins();
  }catch(err){
    adminError.textContent = err.message;
  }
}

async function eliminarAdmin(id){
  if(!confirm('¿Eliminar este administrador?')) return;
  try{
    const res = await fetch(`${BACKEND_URL}/api/admin/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Error al eliminar admin.');
    cargarAdmins();
  }catch(err){
    alert(err.message);
  }
}
