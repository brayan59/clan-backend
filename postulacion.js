// ⚠️ CONFIGURA AQUÍ TU URL DE BACKEND
const BACKEND_URL = "https://clan-backend-cpu4.onrender.com"; // tu URL de Render

let accountInfo = null;
let puntajeTotal = 0;
let respuestas = {
  nombreReal: '',
  apodo: '',
  telefono: '',
  cambioNombre: '',
  pvp: '',
  mapaAbierto: '',
  mapaRotativo: ''
};

function pointsToRank(points){
  if(points == null) return '-';
  points = Number(points);
  const tiers = [
    { name: 'Bronce',   min: 0,    max: 999,  divisions: 3 },
    { name: 'Plata',    min: 1000, max: 1299, divisions: 3 },
    { name: 'Oro',      min: 1300, max: 1599, divisions: 4 },
    { name: 'Platino',  min: 1600, max: 1899, divisions: 4 },
    { name: 'Diamante', min: 1900, max: 2199, divisions: 4 },
    { name: 'Heroico',  min: 2200, max: Infinity, divisions: 0 }
  ];
  for(const tier of tiers){
    if(points >= tier.min && points <= tier.max){
      if(tier.divisions === 0) return `${tier.name} (${points} pts)`;
      const span = (tier.max - tier.min + 1) / tier.divisions;
      let div = Math.floor((points - tier.min) / span) + 1;
      if(div > tier.divisions) div = tier.divisions;
      const romanos = ['I','II','III','IV'];
      return `${tier.name} ${romanos[div-1]} (${points} pts)`;
    }
  }
  return `${points} pts`;
}

function showStep(id){
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function actualizarBarra(){
  document.getElementById('progressFill').style.width = puntajeTotal + '%';
  document.getElementById('puntajeLabel').textContent = puntajeTotal;
}

async function verificarUID(){
  const uid = document.getElementById('uid').value.trim();
  const region = document.getElementById('region').value;
  const error1 = document.getElementById('error1');
  const loading1 = document.getElementById('loading1');
  const btn = document.getElementById('btnVerificar');

  error1.style.display = 'none';
  if(!uid){
    error1.textContent = 'Ingresa tu UID.';
    error1.style.display = 'block';
    return;
  }

  btn.disabled = true;
  loading1.style.display = 'block';

  const url = `${BACKEND_URL}/api/freefire?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}`;

  try{
    const res = await fetch(url);
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);

    const info = data.result && data.result.AccountInfo;
    if(!info) throw new Error('No se encontró esa cuenta. Verifica el UID y la región.');

    accountInfo = info;
    accountInfo._uid = uid;
    accountInfo._region = region;

    document.getElementById('perfilInfo').innerHTML = `
      <div class="row"><span>Nombre</span><span>${info.AccountName ?? '-'}</span></div>
      <div class="row"><span>Nivel</span><span>${info.AccountLevel ?? '-'}</span></div>
      <div class="row"><span>Rango BR</span><span>${pointsToRank(info.BrRankPoint)}</span></div>
      <div class="row"><span>Rango CS</span><span>${pointsToRank(info.CsRankPoint)}</span></div>
    `;
    showStep('step2');

  }catch(err){
    error1.textContent = 'No se pudo verificar: ' + err.message;
    error1.style.display = 'block';
  }finally{
    btn.disabled = false;
    loading1.style.display = 'none';
  }
}

function volverPaso1(){
  accountInfo = null;
  showStep('step1');
}

function irPasoEncuesta(){
  document.getElementById('progressWrap').style.display = 'block';
  actualizarBarra();
  showStep('q_nombre');
}

function responder(campoId, pts, siguienteId){
  respuestas[campoId] = document.getElementById(campoId).value.trim();
  if(respuestas[campoId]){
    puntajeTotal += pts;
    actualizarBarra();
  }
  showStep(siguienteId);
}

function saltar(campoId, pts, siguienteId){
  respuestas[campoId] = '';
  showStep(siguienteId);
}

function responderObligatorio(campoId, errorId, pts, siguienteId){
  const valor = document.getElementById(campoId).value.trim();
  const errorEl = document.getElementById(errorId);
  errorEl.style.display = 'none';
  if(!valor){
    errorEl.textContent = 'Este campo es obligatorio.';
    errorEl.style.display = 'block';
    return;
  }
  respuestas[campoId] = valor;
  puntajeTotal += pts;
  actualizarBarra();
  showStep(siguienteId);
}

function responderSiNo(campoId, pts, siguienteId){
  const valor = document.getElementById(campoId).value;
  respuestas[campoId] = valor;
  if(valor === 'si'){
    puntajeTotal += pts;
    actualizarBarra();
  }
  showStep(siguienteId);
}

function toggleEnviar(){
  document.getElementById('btnEnviar').disabled = !document.getElementById('aceptaReglamento').checked;
}

async function enviarPostulacion(){
  const error3 = document.getElementById('error3');
  const loading3 = document.getElementById('loading3');
  const btn = document.getElementById('btnEnviar');

  error3.style.display = 'none';

  const payload = {
    nombreReal: respuestas.nombreReal || '(no proporcionado)',
    apodo: respuestas.apodo || '(no proporcionado)',
    telefono: respuestas.telefono,
    uid: accountInfo._uid,
    region: accountInfo._region,
    nombreFF: accountInfo.AccountName,
    nivelFF: accountInfo.AccountLevel,
    brRankPoint: accountInfo.BrRankPoint || 0,
    csRankPoint: accountInfo.CsRankPoint || 0,
    cambioNombre: respuestas.cambioNombre,
    experienciaPvp: respuestas.pvp,
    experienciaTorneos: `Abierto: ${respuestas.mapaAbierto}, Rotativo: ${respuestas.mapaRotativo}`,
    aceptoReglamento: true,
    puntajeFinal: puntajeTotal
  };

  btn.disabled = true;
  loading3.style.display = 'block';

  try{
    const res = await fetch(`${BACKEND_URL}/api/postulaciones`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Error al enviar.');

    showStep('step4');

  }catch(err){
    error3.textContent = 'No se pudo enviar tu postulación: ' + err.message;
    error3.style.display = 'block';
    btn.disabled = false;
  }finally{
    loading3.style.display = 'none';
  }
}
