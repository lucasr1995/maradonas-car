// ============================================================
//  db.js – Camada de dados Firebase + localStorage fallback
// ============================================================

let db = null;
let firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK não carregado – usando localStorage');
      return false;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    firebaseReady = true;
    console.log('Firebase conectado!');
    return true;
  } catch(e) {
    console.error('Erro Firebase:', e);
    return false;
  }
}

// ── VEÍCULOS ──────────────────────────────────────────────

async function dbGetCarros() {
  if (!firebaseReady) {
    return JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
  }
  try {
    const snap = await db.collection('carros').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    console.error('Erro ao buscar carros:', e);
    return JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
  }
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
  try {
    const data = { ...carro };
    const id = data.id || null;
    delete data.id;

    if (id) {
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('carros').doc(id).set(data, { merge: true });
      return { id, ...data };
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.views = 0;
      const ref = await db.collection('carros').add(data);
      return { id: ref.id, ...data };
    }
  } catch(e) {
    console.error('Erro ao salvar carro:', e);
    throw e;
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
    if (idx >= 0) {
      list[idx].vendido = vendido;
      list[idx].dataVenda = vendido ? new Date().toLocaleDateString('pt-BR') : null;
    }
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return;
  }
  await db.collection('carros').doc(id).update({
    vendido,
    dataVenda: vendido ? new Date().toLocaleDateString('pt-BR') : null
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
    if (idx >= 0) {
      list[idx].reservado = reservado;
      list[idx].reservadoPor = nomeCliente || null;
    }
    localStorage.setItem('maradonas_carros', JSON.stringify(list));
    return;
  }
  await db.collection('carros').doc(id).update({
    reservado,
    reservadoPor: nomeCliente || null,
    reservaExpira: reservado ? new Date(Date.now() + 24*60*60*1000).toISOString() : null
  });
}

// Inicializa ao carregar a página
document.addEventListener('DOMContentLoaded', initFirebase);
