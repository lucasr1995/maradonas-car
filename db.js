// ============================================================
//  db.js – Camada de dados (Firebase Firestore)
//  Toda comunicação com o banco passa por este arquivo
// ============================================================

// Inicializa Firebase
let db = null;
let storage = null;
let firebaseReady = false;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded – usando localStorage fallback');
    return false;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  db = firebase.firestore();
  storage = firebase.storage();
  firebaseReady = true;
  return true;
}

// ── VEÍCULOS ──────────────────────────────────────────────

async function dbGetCarros() {
  if (!firebaseReady) return JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
  const snap = await db.collection('carros').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function dbSaveCarro(carro) {
  if (!firebaseReady) {
    const list = JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
    if (carro.id) {
      const idx = list.findIndex(c => c.id === carro.id);
      if (idx >= 0) list[idx] = carro; else list.unshift(carro);
    } else {
      carro.id = Date.now().toString();
      list.unshift(carro);
    }
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return carro;
  }
  const data = { ...carro };
  if (data.id) {
    const id = data.id; delete data.id;
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('carros').doc(id).set(data, { merge: true });
    return { id, ...data };
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.views = 0;
    const ref = await db.collection('carros').add(data);
    return { id: ref.id, ...data };
  }
}

async function dbDeleteCarro(id) {
  if (!firebaseReady) {
    const list = JSON.parse(localStorage.getItem('maradonas_carros') || '[]').filter(c => c.id !== id);
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return;
  }
  await db.collection('carros').doc(id).delete();
}

async function dbMarcarVendido(id, vendido) {
  if (!firebaseReady) {
    const list = JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) { list[idx].vendido = vendido; list[idx].dataVenda = vendido ? new Date().toISOString() : null; }
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return;
  }
  await db.collection('carros').doc(id).update({
    vendido,
    dataVenda: vendido ? firebase.firestore.FieldValue.serverTimestamp() : null
  });
}

async function dbIncrementViews(id) {
  if (!firebaseReady) return;
  try {
    await db.collection('carros').doc(id).update({
      views: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) {}
}

async function dbReservarCarro(id, reservado, nomeCliente) {
  if (!firebaseReady) {
    const list = JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) { list[idx].reservado = reservado; list[idx].reservadoPor = nomeCliente; }
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return;
  }
  await db.collection('carros').doc(id).update({
    reservado,
    reservadoPor: nomeCliente || null,
    reservaExpira: reservado ? new Date(Date.now() + 24*60*60*1000).toISOString() : null
  });
}

// ── UPLOAD DE IMAGEM (Firebase Storage) ───────────────────

async function uploadImagem(base64, carroId, index) {
  if (!firebaseReady || !storage) return base64; // fallback: mantém base64
  try {
    const blob = await fetch(base64).then(r => r.blob());
    const ref = storage.ref(`carros/${carroId}/foto_${index}_${Date.now()}`);
    await ref.put(blob);
    return await ref.getDownloadURL();
  } catch(e) {
    console.warn('Upload falhou, usando base64:', e);
    return base64;
  }
}

// Inicializa ao carregar
document.addEventListener('DOMContentLoaded', initFirebase);
