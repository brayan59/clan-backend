
// ⚠️ Cambia este PIN por el que tú quieras
const ADMIN_PIN = "1234";
const BACKEND_URL = "https://clan-backend-cpu4.onrender.com"; // tu URL de Render

function login(){
  const pin = document.getElementById('pin').value;
  if(pin === ADMIN_PIN){
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('container').style.display = 'block';
    cargar();
  } else {
    document.getElementById('loginError').textContent = 'PIN incorrecto.';
  }
}

async function cargar(){
  try{
    const res = await fetch(`${BACKEND_URL}/api/postulaciones`);
    const lista = await res.json();
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';

    lista.forEach((p, i) => {
      const tel = (p.telefono || '').replace(/\D/g,'');
      const msg = encodeURIComponent(`¡Hola ${p.nombreReal}! Fuiste aceptado en el clan. Te esperamos hoy a la hora indicada en el juego. Únete al grupo: [LINK_DEL_GRUPO]`);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${p.nombreReal}</td>
        <td>${p.apodo}</td>
        <td>${p.uid}</td>
        <td>${p.brRankPoint}</td>
        <td>${p.csRankPoint}</td>
        <td>${p.tasaHeadshot}</td>
        <td style="font-size:11px">${p.experienciaTorneos}</td>
        <td>${p.experienciaPvp}</td>
        <td><strong>${p.puntajeFinal}</strong></td>
        <td><span class="badge ${p.estado}">${p.estado}</span></td>
        <td class="actions">
          <button class="btn-aceptar" onclick="cambiarEstado('${p._id}','aceptado')">Aceptar</button>
          <button class="btn-rechazar" onclick="cambiarEstado('${p._id}','rechazado')">Rechazar</button>
          <a href="https://wa.me/${tel}?text=${msg}" target="_blank"><button class="btn-whatsapp">WhatsApp</button></a>
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
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({estado})
    });
    cargar();
  }catch(err){
    alert('Error al actualizar: ' + err.message);
  }
}
