// ============================================================
//  db.js – Firebase com inicialização garantida
// ============================================================

let _db = null;
let _initPromise = null;

function _init() {
  if (_initPromise) return _initPromise;
  _initPromise = new Promise((resolve) => {
    function tryInit() {
      try {
        if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
          setTimeout(tryInit, 100);
          return;
        }
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        _db = firebase.firestore();
        console.log('✅ Firebase pronto');
        resolve(_db);
      } catch(e) {
        console.error('Firebase erro:', e);
        resolve(null);
      }
    }
    tryInit();
  });
  return _initPromise;
}

async function dbGetCarros() {
  const db = await _init();
  if (!db) return JSON.parse(localStorage.getItem('maradonas_carros') || '[]');
  try {
    const snap = await db.collection('carros').orderBy('createdAt', 'desc').get();
    const carros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('📦 Carros carregados:', carros.length);
    return carros;
  } catch(e) {
    console.error('Erro buscar carros:', e);
    return [];
  }
}

async function dbSaveCarro(carro) {
  const db = await _init();
  if (!db) {
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
}

async function dbDeleteCarro(id) {
  const db = await _init();
  if (!db) return;
  await db.collection('carros').doc(id).delete();
}

async function dbMarcarVendido(id, vendido) {
  const db = await _init();
  if (!db) return;
  await db.collection('carros').doc(id).update({
    vendido,
    dataVenda: vendido ? new Date().toLocaleDateString('pt-BR') : null
  });
}

async function dbIncrementViews(id) {
  const db = await _init();
  if (!db) return;
  try {
    await db.collection('carros').doc(id).update({
      views: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) {}
}

async function dbReservarCarro(id, reservado, nomeCliente) {
  const db = await _init();
  if (!db) return;
  await db.collection('carros').doc(id).update({
    reservado,
    reservadoPor: nomeCliente || null,
    reservaExpira: reservado ? new Date(Date.now() + 24*60*60*1000).toISOString() : null
  });
}
