/* MiniBus Zavalla — Vanilla JS app
 * Recorrido: Plaza Sarmiento (Rosario) ↔ Parque Villarino (Zavalla)
 * Horarios: Ida 07:00 desde Plaza Sarmiento · Vuelta 13:00 desde Parque Villarino
 * Una sola reserva por día cubre ida + vuelta automáticamente.
 */
(() => {
  'use strict';

  // ---------- Constantes de recorrido ----------
  const HORARIO_IDA = '07:00';
  const HORARIO_VUELTA = '13:00';
  const ORIGEN_IDA = 'Plaza Sarmiento (Rosario)';
  const DESTINO_IDA = 'Parque Villarino (Zavalla)';
  const ORIGEN_VUELTA = 'Parque Villarino (Zavalla)';
  const DESTINO_VUELTA = 'Plaza Sarmiento (Rosario)';
const HORA_APERTURA = 8;
const HORA_CIERRE = 12;
// Modo prueba-----------

const MODO_PRUEBA = true;
const HORA_PRUEBA = 8;


  // ---------- Storage helpers ----------
  const KEYS = {
    usuarios: 'mb_usuarios',
    viajes: 'mb_viajes',
    reservas: 'mb_reservas',
    session: 'mb_session',
    theme: 'mb_theme',
    quejas: 'mb_quejas',
  };
  const load = (k, fb) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const DB = {
    get usuarios() { return load(KEYS.usuarios, []); },
    set usuarios(v) { save(KEYS.usuarios, v); },
    get viajes() { return load(KEYS.viajes, []); },
    set viajes(v) { save(KEYS.viajes, v); },
    get reservas() { return load(KEYS.reservas, []); },
    set reservas(v) { save(KEYS.reservas, v); },
    get session() { return load(KEYS.session, null); },
    set session(v) { v ? save(KEYS.session, v) : localStorage.removeItem(KEYS.session); },
    get quejas() { return load(KEYS.quejas, []); },
    set quejas(v) { save(KEYS.quejas, v); },
  };

  // ---------- Seed inicial ----------
  function seed() {
    if (DB.usuarios.length === 0) {
      const admin = {
        id: uid(), email: 'admin@minibus.com', password: 'admin',
        nombre: 'Admin', apellido: 'Sistema', sector: 'Sistemas',
        prioridad: 3, rol: 'admin', creadoEn: Date.now(),
      };
      const demo = {
        id: uid(), email: 'demo@minibus.com', password: 'demo',
        nombre: 'Juan', apellido: 'Pérez', sector: 'Producción',
        prioridad: 1, rol: 'user', creadoEn: Date.now(),
      };
      DB.usuarios = [admin, demo];
    }
    if (DB.viajes.length === 0) {
      const today = new Date();
      const viajes = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        // Viaje de ida
viajes.push({
  id: uid(),
  fecha: ymd(d),
  tipo: 'ida',
  horario: HORARIO_IDA,
  origen: ORIGEN_IDA,
  destino: DESTINO_IDA,
  capacidad: 24,
  creadoEn: Date.now(),
});

// Viaje de vuelta
viajes.push({
  id: uid(),
  fecha: ymd(d),
  tipo: 'vuelta',
  horario: HORARIO_VUELTA,
  origen: ORIGEN_VUELTA,
  destino: DESTINO_VUELTA,
  capacidad: 24,
  creadoEn: Date.now(),
});
      }
      DB.viajes = viajes;
    } else {
      // Migración: viajes antiguos pueden tener "horario/origen/destino" — los normalizamos
      DB.viajes = DB.viajes.map(v => ({
        id: v.id,
        fecha: v.fecha,
        tipo: v.tipo || 'ida',
        horario: v.horario || (v.tipo === 'vuelta' ? HORARIO_VUELTA : HORARIO_IDA),
        origen: v.origen || (v.tipo === 'vuelta' ? ORIGEN_VUELTA : ORIGEN_IDA),
        destino: v.destino || (v.tipo === 'vuelta' ? DESTINO_VUELTA : DESTINO_IDA),
        capacidad: v.capacidad || 24,
        creadoEn: v.creadoEn || Date.now(),
      }));
      // Completar: cada fecha debe tener viaje de ida Y de vuelta
      const fechas = [...new Set(DB.viajes.map(v => v.fecha))];
      fechas.forEach(fecha => {
        const enFecha = DB.viajes.filter(v => v.fecha === fecha);
        const capBase = enFecha[0]?.capacidad || 24;
        if (!enFecha.some(v => v.tipo === 'ida')) {
          DB.viajes.push({
            id: uid(), fecha, tipo: 'ida',
            horario: HORARIO_IDA, origen: ORIGEN_IDA, destino: DESTINO_IDA,
            capacidad: capBase, creadoEn: Date.now(),
          });
        }
        if (!enFecha.some(v => v.tipo === 'vuelta')) {
          DB.viajes.push({
            id: uid(), fecha, tipo: 'vuelta',
            horario: HORARIO_VUELTA, origen: ORIGEN_VUELTA, destino: DESTINO_VUELTA,
            capacidad: capBase, creadoEn: Date.now(),
          });
        }
      });
    }
  }

  // ---------- Utils ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const ymd = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  };
  const fmtDateLong = (s) => {
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const fmtDay = (s) => new Date(s + 'T12:00:00').getDate();
  const fmtMonth = (s) => new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' });
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  // ---------- Ventana de inscripción ----------
  // Regla: la inscripción abre a las 20:00 hs del día anterior al viaje.
  // Se puede reservar durante esa noche y hasta antes de que salga el minibús.
 function puedeReservar(fecha) {
    return { ok: true };
}

  // ---------- Reservas: lógica con prioridades y lista de espera ----------
  function reservasDeViaje(viajeId) {
    return DB.reservas
      .filter(r => r.viajeId === viajeId)
      .sort((a,b) => a.orden - b.orden);
  }
  function recomputarOrdenes(viajeId) {
    const viaje = DB.viajes.find(v => v.id === viajeId);
    if (!viaje) return;
    const rs = DB.reservas.filter(r => r.viajeId === viajeId);
    rs.sort((a,b) => {
      if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;
      return a.creadoEn - b.creadoEn;
    });
    rs.forEach((r, i) => {
      r.orden = i + 1;
      r.estado = i < viaje.capacidad ? 'confirmada' : 'espera';
    });
    const otros = DB.reservas.filter(r => r.viajeId !== viajeId);
    DB.reservas = [...otros, ...rs];
  }
  function reservar(viajeId, usuarioId, tipoServicio = 'normal') {
    const u = DB.usuarios.find(x => x.id === usuarioId);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    const viaje = DB.viajes.find(v => v.id === viajeId);
    if (!viaje) return { ok: false, error: 'Viaje no encontrado' };
    const ventana = puedeReservar(viaje.fecha);
    if (!ventana.ok) return { ok: false, error: ventana.msg };
    if (DB.reservas.some(r => r.viajeId === viajeId && r.usuarioId === usuarioId)) {
      return { ok: false, error: 'Ya tenés una reserva para este día' };
    }
    // Prioridad efectiva: si eligió "prioridad" se suma un boost sobre su prioridad base
    const prioBase = u.prioridad || 1;
    const prioEfectiva = tipoServicio === 'prioridad' ? prioBase + 3 : prioBase;
    DB.reservas = [...DB.reservas, {
      id: uid(), viajeId, usuarioId,
      prioridad: prioEfectiva,
      tipoServicio,
      creadoEn: Date.now(),
      orden: 0, estado: 'pendiente',
    }];
    recomputarOrdenes(viajeId);
    const r = DB.reservas.find(x => x.viajeId === viajeId && x.usuarioId === usuarioId);
    return { ok: true, reserva: r };
  }
  function cancelar(reservaId) {
    const r = DB.reservas.find(x => x.id === reservaId);
    if (!r) return;
    DB.reservas = DB.reservas.filter(x => x.id !== reservaId);
    recomputarOrdenes(r.viajeId);
  }


  // ---------- Helpers por día (ida/vuelta separados) ----------
  function viajesDia(fecha) {
    const arr = DB.viajes.filter(v => v.fecha === fecha);
    return { ida: arr.find(v => v.tipo === 'ida'), vuelta: arr.find(v => v.tipo === 'vuelta') };
  }
  function fechasFuturas() {
    const hoy = ymd(new Date());
    return [...new Set(DB.viajes.filter(v => v.fecha >= hoy).map(v => v.fecha))]
      .sort((a,b) => a.localeCompare(b));
  }
  function misReservasDia(fecha, userId) {
    const { ida, vuelta } = viajesDia(fecha);
    return {
      ida: ida ? DB.reservas.find(r => r.viajeId === ida.id && r.usuarioId === userId) : null,
      vuelta: vuelta ? DB.reservas.find(r => r.viajeId === vuelta.id && r.usuarioId === userId) : null,
    };
  }
  function reservarOpcion(fecha, usuarioId, opcion, tipoServicio = 'normal') {
    const { ida, vuelta } = viajesDia(fecha);
    const results = [];
    if ((opcion === 'ida' || opcion === 'ambos') && ida) {
      const exist = DB.reservas.find(r => r.viajeId === ida.id && r.usuarioId === usuarioId);
      if (!exist) results.push({ tipo: 'ida', ...reservar(ida.id, usuarioId, tipoServicio) });
    }
    if ((opcion === 'vuelta' || opcion === 'ambos') && vuelta) {
      const exist = DB.reservas.find(r => r.viajeId === vuelta.id && r.usuarioId === usuarioId);
      if (!exist) results.push({ tipo: 'vuelta', ...reservar(vuelta.id, usuarioId, tipoServicio) });
    }
    if (results.length === 0) return { ok: false, error: 'Ya tenés esa reserva' };
    const err = results.find(r => !r.ok);
    if (err) return err;
    return { ok: true, reservas: results };
  }

  // ---------- Auth ----------
  function currentUser() {
    const s = DB.session;
    if (!s) return null;
    return DB.usuarios.find(u => u.id === s.userId) || null;
  }
  function login(email, password) {
    const u = DB.usuarios.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return { ok: false, error: 'Email o contraseña incorrectos' };
    DB.session = { userId: u.id };
    return { ok: true };
  }
  function register(data) {
    if (!data.email || !data.password || !data.nombre || !data.apellido) {
      return { ok: false, error: 'Completá todos los campos' };
    }
    if (DB.usuarios.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: 'Ya existe un usuario con ese email' };
    }
    const u = {
      id: uid(), email: data.email, password: data.password,
      nombre: data.nombre, apellido: data.apellido,
      sector: data.sector || 'Sin sector', prioridad: 1, rol: 'user',
      creadoEn: Date.now(),
    };
    DB.usuarios = [...DB.usuarios, u];
    DB.session = { userId: u.id };
    return { ok: true };
  }
  function logout() { DB.session = null; render(); }

  // ---------- Router ----------
  let currentView = 'home';
  function navigate(view) { currentView = view; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ---------- Theme ----------
  function initTheme() {
    const t = localStorage.getItem(KEYS.theme) || 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEYS.theme, next);
  }

  // ---------- Render ----------
  function render() {
    const root = document.getElementById('app');
    const user = currentUser();
    if (!user) { root.innerHTML = ViewAuth(); bindAuth(); return; }
    root.innerHTML = `
      ${TopBar(user)}
      <main>${renderMain(user)}</main>
      ${BottomNav(user)}
    `;
    bindShell();
    bindView(user);
  }

  function renderMain(user) {
    switch (currentView) {
      case 'home': return ViewHome(user);
      case 'trips': return ViewTrips(user);
      case 'history': return ViewHistory(user);
      case 'stats': return ViewStats(user);
      case 'profile': return ViewProfile(user);
      case 'admin': return user.rol === 'admin' ? ViewAdmin(user) : ViewHome(user);
      default: return ViewHome(user);
    }
  }

  // ---------- Components ----------
  function TopBar(user) {
    return `
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark"><img src="images/logo-bus.png" alt="Logo MiniBus" /></div>
          <div>
            <div style="font-size:15px">MiniBus Zavalla</div>
            <div class="muted" style="font-size:11px; font-weight:500">Plaza Sarmiento ↔ Parque Villarino</div>
          </div>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn" data-act="theme" title="Tema">
            ${document.documentElement.getAttribute('data-theme') === 'dark' ? sun() : moon()}
          </button>
          <button class="icon-btn" data-act="logout" title="Salir">${iconLogout()}</button>
        </div>
      </header>
    `;
  }

  function HeroBanner() {
    return `
      <div class="hero">
       <img src="images/hero-autumn.jpg" alt="Parque Villarino en otoño" />
        <div class="hero-overlay">
          <div>
            <h2>Bienvenido al MiniBus Zavalla</h2>
            <p>Ida 07:00 hs · Vuelta 13:00 hs — Reservá ida, vuelta o ambos por separado</p>
          </div>
        </div>
      </div>
    `;
  }

  function BottomNav(user) {
    const items = [
      { id: 'home', label: 'Hoy', icon: iconHome() },
      { id: 'trips', label: 'Viajes', icon: iconCalendar() },
      { id: 'history', label: 'Historial', icon: iconList() },
      { id: 'stats', label: 'Stats', icon: iconStats() },
      user.rol === 'admin'
        ? { id: 'admin', label: 'Admin', icon: iconAdmin() }
        : { id: 'profile', label: 'Perfil', icon: iconUser() },
    ];
    return `<nav class="bottom-nav">${items.map(i => `
      <button class="nav-item ${currentView === i.id ? 'active' : ''}" data-nav="${i.id}">
        ${i.icon}<span>${i.label}</span>
      </button>`).join('')}</nav>`;
  }

  // ---------- Views ----------
  function ViewAuth() {
    return `
      <div class="auth-wrap">
        <div class="card auth-card">
          <div class="brand" style="justify-content:center; margin-bottom:18px">
           <div class="brand-mark"><img src="images/logo-bus.png" alt="Logo" /></div>
            <div>
              <div style="font-size:18px">MiniBus Zavalla</div>
              <div class="muted" style="font-size:12px">Transporte corporativo</div>
            </div>
          </div>
          <div class="auth-tabs">
            <button class="active" data-tab="login">Ingresar</button>
            <button data-tab="register">Crear cuenta</button>
          </div>
          <div id="auth-body">${LoginForm()}</div>
          <p class="muted" style="text-align:center; margin-top:14px; font-size:12px">
            Demo: <b>admin@minibus.com</b> / <b>admin</b> · <b>demo@minibus.com</b> / <b>demo</b>
          </p>
        </div>
      </div>
    `;
  }
  function LoginForm() {
    return `
      <form id="login-form" class="stack">
        <div class="field"><label>Email</label><input class="input" name="email" type="email" required autocomplete="email" /></div>
        <div class="field"><label>Contraseña</label><input class="input" name="password" type="password" required autocomplete="current-password" /></div>
        <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
      </form>`;
  }
  function RegisterForm() {
    return `
      <form id="register-form" class="stack">
        <div class="row">
          <div class="field" style="flex:1; min-width:120px"><label>Nombre</label><input class="input" name="nombre" required /></div>
          <div class="field" style="flex:1; min-width:120px"><label>Apellido</label><input class="input" name="apellido" required /></div>
        </div>
        <div class="field"><label>Sector</label><input class="input" name="sector" placeholder="Producción, RRHH, IT…" /></div>
        <div class="field"><label>Email</label><input class="input" name="email" type="email" required /></div>
        <div class="field"><label>Contraseña</label><input class="input" name="password" type="password" required minlength="4" /></div>
        <button class="btn btn-primary btn-block" type="submit">Crear cuenta</button>
      </form>`;
  }

  function RouteSummary() {
    return `
      <div class="route-block">
        <div class="route-icon">→</div>
        <div style="flex:1">
          <div class="r-t">Ida · ${HORARIO_IDA} hs</div>
          <div class="r-s">${ORIGEN_IDA} → ${DESTINO_IDA}</div>
        </div>
      </div>
      <div class="route-block vuelta">
        <div class="route-icon">←</div>
        <div style="flex:1">
          <div class="r-t">Vuelta · ${HORARIO_VUELTA} hs</div>
          <div class="r-s">${ORIGEN_VUELTA} → ${DESTINO_VUELTA}</div>
        </div>
      </div>
    `;
  }

  function ViewHome(user) {
    const fechas = fechasFuturas();
    const fechaHoy = fechas[0];
    if (!fechaHoy) {
      return `
        ${HeroBanner()}
        <h2 class="section-title">Hola, ${escapeHtml(user.nombre)} 👋</h2>
        <p class="section-sub">No hay viajes programados próximamente.</p>
        ${user.rol === 'admin' ? `<button class="btn btn-primary" data-nav="admin">Crear un viaje</button>` : ''}`;
    }
    return `
      ${HeroBanner()}
      <h2 class="section-title">Hola, ${escapeHtml(user.nombre)} 👋</h2>
      <p class="section-sub">Tu próximo viaje a Zavalla.</p>
      ${TripFullCard(fechaHoy, user)}
      ${fechas.length > 1 ? `
        <div class="spacer"></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Próximos viajes</div>
            <button class="btn btn-ghost btn-sm" data-nav="trips">Ver todos</button>
          </div>
          <div class="stack">
            ${fechas.slice(1, 4).map(f => TripMiniCard(f, user)).join('')}
          </div>
        </div>` : ''}
    `;
  }

  function TripFullCard(fecha, user) {
    const { ida, vuelta } = viajesDia(fecha);
    if (!ida && !vuelta) return '';
    const rsIda = ida ? reservasDeViaje(ida.id) : [];
    const rsVuelta = vuelta ? reservasDeViaje(vuelta.id) : [];
    const confIda = rsIda.filter(r => r.estado === 'confirmada').length;
    const confVuelta = rsVuelta.filter(r => r.estado === 'confirmada').length;
    const mis = misReservasDia(fecha, user.id);
    const ventana = puedeReservar(fecha);

    const canIda = !!ida && !mis.ida;
    const canVuelta = !!vuelta && !mis.vuelta;
    const canAmbos = canIda && canVuelta;

    const misStatus = (mis.ida || mis.vuelta) ? `
      <div class="stack">
        ${mis.ida ? `
          <div class="list-item is-me">
            <div class="order">${mis.ida.orden}</div>
            <div style="flex:1">
              <div style="font-weight:700">Ida · ${HORARIO_IDA} hs</div>
              <div class="muted" style="font-size:12px">
                ${mis.ida.estado === 'confirmada' ? `Confirmada · Orden #${mis.ida.orden}` : `Lista de espera · Posición ${mis.ida.orden - ida.capacidad}`}
              </div>
            </div>
            <button class="btn btn-danger btn-sm" data-cancel="${mis.ida.id}">Cancelar</button>
          </div>` : ''}
        ${mis.vuelta ? `
          <div class="list-item is-me">
            <div class="order">${mis.vuelta.orden}</div>
            <div style="flex:1">
              <div style="font-weight:700">Vuelta · ${HORARIO_VUELTA} hs</div>
              <div class="muted" style="font-size:12px">
                ${mis.vuelta.estado === 'confirmada' ? `Confirmada · Orden #${mis.vuelta.orden}` : `Lista de espera · Posición ${mis.vuelta.orden - vuelta.capacidad}`}
              </div>
            </div>
            <button class="btn btn-danger btn-sm" data-cancel="${mis.vuelta.id}">Cancelar</button>
          </div>` : ''}
      </div>
    ` : '';

    const picker = (ventana.ok && (canIda || canVuelta)) ? `
      <div class="card" style="background:var(--bg-soft); box-shadow:none; padding:14px">
        <div style="font-weight:700; margin-bottom:10px">🎟️ Elegí qué tramos reservar</div>
        <div class="stack" style="gap:8px">
          ${canIda ? `
            <label style="display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elev); cursor:pointer">
              <input type="radio" name="opt-${fecha}" value="ida" ${canIda ? 'checked' : ''} style="margin-top:3px" />
              <div><div style="font-weight:700">A · Solo ida</div>
                <div class="muted" style="font-size:12px">${HORARIO_IDA} hs · ${ORIGEN_IDA} → ${DESTINO_IDA}</div></div>
            </label>` : ''}
          ${canVuelta ? `
            <label style="display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elev); cursor:pointer">
              <input type="radio" name="opt-${fecha}" value="vuelta" ${!canIda ? 'checked' : ''} style="margin-top:3px" />
              <div><div style="font-weight:700">B · Solo vuelta</div>
                <div class="muted" style="font-size:12px">${HORARIO_VUELTA} hs · ${ORIGEN_VUELTA} → ${DESTINO_VUELTA}</div></div>
            </label>` : ''}
          ${canAmbos ? `
            <label style="display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elev); cursor:pointer">
              <input type="radio" name="opt-${fecha}" value="ambos" style="margin-top:3px" />
              <div><div style="font-weight:700">C · Ida y vuelta</div>
                <div class="muted" style="font-size:12px">Reservás ambos tramos del día</div></div>
            </label>` : ''}
        </div>

        <div class="spacer"></div>
        <div style="font-weight:700; margin-bottom:10px">⭐ Tipo de viaje</div>
        <div class="stack" style="gap:8px">
          <label style="display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elev); cursor:pointer">
            <input type="radio" name="svc-${fecha}" value="normal" checked style="margin-top:3px" />
            <div><div style="font-weight:700">A · Viaje normal</div>
              <div class="muted" style="font-size:12px">Reserva estándar según orden de llegada.</div></div>
          </label>
          <label style="display:flex; align-items:flex-start; gap:10px; padding:12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elev); cursor:pointer">
            <input type="radio" name="svc-${fecha}" value="prioridad" style="margin-top:3px" />
            <div><div style="font-weight:700">B · Viaje de prioridad</div>
              <div class="muted" style="font-size:12px">Se ubica antes en la lista frente a reservas normales.</div></div>
          </label>
        </div>

        <div class="spacer"></div>
        <button class="btn btn-primary btn-block" data-book-day="${fecha}">Reservar</button>
      </div>
    ` : (!ventana.ok ? `<div class="notice">🍁 <div><b>Inscripción cerrada.</b> ${escapeHtml(ventana.msg || '')}.</div></div>` : '');

    const totalCap = (ida?.capacidad || 0) + (vuelta?.capacidad || 0);
    const totalConf = confIda + confVuelta;

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title" style="text-transform:capitalize">${escapeHtml(fmtDateLong(fecha))}</div>
            <div class="muted" style="font-size:13px; margin-top:4px">
              🍂 Ida ${HORARIO_IDA} · Vuelta ${HORARIO_VUELTA}
            </div>
          </div>
          <span class="badge ok">${totalConf}/${totalCap}</span>
        </div>
        <div class="spacer"></div>
        ${RouteSummary()}
        <div class="spacer"></div>
        ${misStatus}
        ${(misStatus && picker) ? '<div class="spacer"></div>' : ''}
        ${picker}
      </div>
    `;
  }

    function PassengerItem(r, user, isWait) {
    const u = DB.usuarios.find(x => x.id === r.usuarioId);
    if (!u) return '';
    const isMe = u.id === user.id;
    return `
      <div class="list-item ${isMe ? 'is-me' : ''} ${isWait ? 'waitlist' : ''}">
        <div class="order">${r.orden}</div>
        <div class="avatar" style="width:32px;height:32px;font-size:13px">${escapeHtml((u.nombre[0]||'') + (u.apellido[0]||''))}</div>
        <div style="flex:1; min-width:0">
          <div style="font-weight:600; font-size:14px">${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}${isMe ? ' (vos)' : ''}</div>
          <div class="muted" style="font-size:12px">${escapeHtml(u.sector)}</div>
        </div>
        ${u.prioridad >= 2 ? `<span class="badge brand">P${u.prioridad}</span>` : ''}
      </div>`;
  }

  function SeatMap(viaje, reservas, user) {
    const seats = [];
    const confirmadas = reservas.filter(r => r.estado === 'confirmada');
    const yoTengo = reservas.find(r => r.usuarioId === user.id);
    const ventana = puedeReservar(viaje.fecha);
    for (let i = 1; i <= viaje.capacidad; i++) {
      const r = confirmadas.find(x => x.orden === i);
      let cls = 'free';
      let label = i;
      let title = `Asiento ${i} — libre`;
      let action = '';
      if (r) {
        const u = DB.usuarios.find(x => x.id === r.usuarioId);
        cls = (u && u.id === user.id) ? 'mine' : 'taken';
        title = `Asiento ${i} — ${u ? u.nombre + ' ' + u.apellido : 'ocupado'}`;
      } else if (!yoTengo && ventana.ok) {
        cls += ' me-can-book';
        action = `data-book="${viaje.id}"`;
      }
      seats.push(`<button class="seat ${cls}" title="${escapeHtml(title)}" ${action}>${label}</button>`);
    }
    const espera = reservas.filter(r => r.estado === 'espera').length;
    return `
      <div class="bus">
        <div class="bus-front">
          <span>🚪 Puerta</span>
          <span>Frente del minibús</span>
          <div class="steering" aria-hidden="true"></div>
        </div>
        <div class="seat-grid">${seats.join('')}</div>
        <div class="seat-legend">
          <span><span class="dot free"></span>Libre</span>
          <span><span class="dot taken"></span>Ocupado</span>
          <span><span class="dot mine"></span>Tu asiento</span>
          <span><span class="dot wait"></span>Lista de espera (${espera})</span>
        </div>
      </div>
    `;
  }

  function TripMiniCard(fecha, user) {
    const { ida, vuelta } = viajesDia(fecha);
    const cap = (ida?.capacidad || 0) + (vuelta?.capacidad || 0);
    const conf = (ida ? DB.reservas.filter(r => r.viajeId === ida.id && r.estado === 'confirmada').length : 0)
               + (vuelta ? DB.reservas.filter(r => r.viajeId === vuelta.id && r.estado === 'confirmada').length : 0);
    const mis = misReservasDia(fecha, user.id);
    const tag = (mis.ida && mis.vuelta) ? 'Ida + Vuelta' : mis.ida ? 'Solo ida' : mis.vuelta ? 'Solo vuelta' : '';
    return `
      <div class="trip-card" data-day="${fecha}">
        <div class="trip-date">
          <div class="day">${fmtDay(fecha)}</div>
          <div class="month">${fmtMonth(fecha).replace('.','')}</div>
        </div>
        <div class="trip-meta">
          <div class="t1" style="text-transform:capitalize">${escapeHtml(fmtDateLong(fecha))}</div>
          <div class="t2">🕖 ${HORARIO_IDA} ida · 🕐 ${HORARIO_VUELTA} vuelta · ${conf}/${cap}</div>
          <div class="occupancy-bar"><span style="width:${cap ? Math.min(100, (conf/cap)*100) : 0}%"></span></div>
        </div>
        ${tag ? `<span class="badge ok">${tag}</span>` : ''}
      </div>`;
  }

    function ViewTrips(user) {
    const hoy = ymd(new Date());
    const futuros = DB.viajes.filter(v => v.fecha >= hoy).sort((a,b) => a.fecha.localeCompare(b.fecha));
    const fechas = fechasFuturas();
    const semana = buildWeek(futuros);
    return `
      <h2 class="section-title">Calendario semanal</h2>
      <p class="section-sub">Recordá: la inscripción para cada día abre la noche anterior a las 20:00 hs.</p>
      <div class="calendar">${semana.map(d => CalDay(d)).join('')}</div>
      <div class="spacer"></div>
      <h3 class="section-title" style="font-size:18px">Próximos viajes</h3>
      <div class="stack">
        ${fechas.length ? fechas.map(f => TripMiniCard(f, user)).join('') : `<div class="empty"><div class="em">📭</div>No hay viajes programados</div>`}
      </div>
    `;
  }
  function buildWeek(viajes) {
    const today = new Date();
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const f = ymd(d);
      const v = viajes.find(x => x.fecha === f);
      let occ = null;
      if (v) {
        const conf = DB.reservas.filter(r => r.viajeId === v.id && r.estado === 'confirmada').length;
        occ = { conf, cap: v.capacidad };
      }
      arr.push({ date: d, fecha: f, viaje: v, occ });
    }
    return arr;
  }
  function CalDay({ date, viaje, occ }) {
    const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' });
    const dayNum = date.getDate();
    const pct = occ ? Math.round((occ.conf / occ.cap) * 100) : 0;
    return `
      <div class="cal-day ${viaje ? 'has-trip' : ''}" ${viaje ? `data-trip="${viaje.id}"` : ''}>
        <div class="cd-h"><span>${escapeHtml(dayName)}</span><span>${dayNum}</span></div>
        ${viaje ? `
          <div class="occ">${occ.conf}<span class="muted" style="font-size:13px; font-weight:500">/${occ.cap}</span></div>
          <div class="barmini"><span style="width:${pct}%"></span></div>
          <div class="muted" style="font-size:11px">${HORARIO_IDA} / ${HORARIO_VUELTA}</div>
        ` : `<div class="muted" style="font-size:12px; margin-top:auto">Sin viaje</div>`}
      </div>`;
  }

  function ViewHistory(user) {
    const mis = DB.reservas
      .filter(r => r.usuarioId === user.id)
      .map(r => ({ ...r, viaje: DB.viajes.find(v => v.id === r.viajeId) }))
      .filter(r => r.viaje)
      .sort((a,b) => b.viaje.fecha.localeCompare(a.viaje.fecha));
    const total = mis.length;
    const conf = mis.filter(r => r.estado === 'confirmada').length;
    return `
      <h2 class="section-title">Mi historial</h2>
      <div class="grid-2">
        <div class="stat"><div class="k">Reservas totales</div><div class="v">${total}</div></div>
        <div class="stat"><div class="k">Confirmadas</div><div class="v">${conf}</div></div>
      </div>
      <div class="spacer"></div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">Reservas</div>
        ${mis.length ? `<div class="stack">${mis.map(r => `
          <div class="list-item">
            <div class="order">#${r.orden}</div>
            <div style="flex:1; min-width:0">
              <div style="font-weight:600; text-transform:capitalize">${escapeHtml(fmtDateLong(r.viaje.fecha))}</div>
              <div class="muted" style="font-size:12px">${r.viaje.tipo === 'vuelta' ? 'Vuelta · ' + HORARIO_VUELTA : 'Ida · ' + HORARIO_IDA} hs</div>
            </div>
            <span class="badge ${r.estado==='confirmada'?'ok':'warn'}">${r.estado}</span>
          </div>`).join('')}</div>` : `<div class="empty"><div class="em">🗒️</div>Aún no tenés reservas</div>`}
      </div>
    `;
  }

  function ViewStats(user) {
    const ahora = new Date();
    const mesActual = ymd(ahora).slice(0, 7);
    const reservasMes = DB.reservas.filter(r => {
      const v = DB.viajes.find(x => x.id === r.viajeId);
      return v && v.fecha.startsWith(mesActual);
    });
    const viajesMes = DB.viajes.filter(v => v.fecha.startsWith(mesActual));
    const cupos = viajesMes.reduce((s,v) => s + v.capacidad, 0);
    const ocupados = reservasMes.filter(r => r.estado === 'confirmada').length;
    const pctOcup = cupos ? Math.round((ocupados/cupos)*100) : 0;

    const ranking = {};
    DB.reservas.forEach(r => {
      if (r.estado !== 'confirmada') return;
      ranking[r.usuarioId] = (ranking[r.usuarioId] || 0) + 1;
    });
    const top = Object.entries(ranking)
      .map(([uid, n]) => ({ user: DB.usuarios.find(u => u.id === uid), n }))
      .filter(x => x.user)
      .sort((a,b) => b.n - a.n)
      .slice(0, 5);

    const demanda = {};
    DB.reservas.forEach(r => {
      const v = DB.viajes.find(x => x.id === r.viajeId);
      if (!v) return;
      const d = new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long' });
      demanda[d] = (demanda[d] || 0) + 1;
    });
    const demandaTop = Object.entries(demanda).sort((a,b) => b[1] - a[1]);

    return `
      <h2 class="section-title">Estadísticas</h2>
      <p class="section-sub">Resumen del mes en curso.</p>
      <div class="grid-2">
        <div class="stat"><div class="k">Viajes del mes</div><div class="v">${viajesMes.length}</div></div>
        <div class="stat"><div class="k">Reservas confirmadas</div><div class="v">${ocupados}</div></div>
        <div class="stat"><div class="k">Cupos totales</div><div class="v">${cupos}</div></div>
        <div class="stat"><div class="k">% ocupación</div><div class="v">${pctOcup}%</div></div>
      </div>
      <div class="spacer"></div>
      <div class="card">
        <div class="card-title">🏆 Ranking de asistencia</div>
        <div class="spacer"></div>
        ${top.length ? `<div class="stack">${top.map((x,i) => `
          <div class="list-item ${x.user.id===user.id?'is-me':''}">
            <div class="order">${i+1}</div>
            <div class="avatar" style="width:32px;height:32px;font-size:13px">${escapeHtml((x.user.nombre[0]||'') + (x.user.apellido[0]||''))}</div>
            <div style="flex:1"><div style="font-weight:600">${escapeHtml(x.user.nombre)} ${escapeHtml(x.user.apellido)}</div>
              <div class="muted" style="font-size:12px">${escapeHtml(x.user.sector)}</div></div>
            <span class="badge brand">${x.n} viajes</span>
          </div>`).join('')}</div>` : '<p class="muted">Sin datos aún</p>'}
      </div>
      <div class="card">
        <div class="card-title">📊 Días con mayor demanda</div>
        <div class="spacer"></div>
        ${demandaTop.length ? `<div class="stack">${demandaTop.map(([d,n]) => {
          const max = demandaTop[0][1];
          return `<div>
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px">
              <span style="text-transform:capitalize">${escapeHtml(d)}</span><span class="muted">${n} reservas</span>
            </div>
            <div class="occupancy-bar"><span style="width:${(n/max)*100}%"></span></div>
          </div>`;
        }).join('')}</div>` : '<p class="muted">Sin datos aún</p>'}
      </div>
    `;
  }

  function ViewProfile(user) {
    return `
      <h2 class="section-title">Mi perfil</h2>
      <div class="card">
        <div class="profile-head">
          <div class="avatar">${escapeHtml((user.nombre[0]||'') + (user.apellido[0]||''))}</div>
          <div style="flex:1">
            <div style="font-weight:700; font-size:17px">${escapeHtml(user.nombre)} ${escapeHtml(user.apellido)}</div>
            <div class="muted" style="font-size:13px">${escapeHtml(user.email)}</div>
          </div>
          <span class="badge brand">Prioridad ${user.prioridad}</span>
        </div>
        <div class="spacer"></div>
        <form id="profile-form" class="stack">
          <div class="row">
            <div class="field" style="flex:1; min-width:140px"><label>Nombre</label><input class="input" name="nombre" value="${escapeHtml(user.nombre)}" required /></div>
            <div class="field" style="flex:1; min-width:140px"><label>Apellido</label><input class="input" name="apellido" value="${escapeHtml(user.apellido)}" required /></div>
          </div>
          <div class="field"><label>Sector</label><input class="input" name="sector" value="${escapeHtml(user.sector)}" /></div>
          <button class="btn btn-primary" type="submit">Guardar cambios</button>
        </form>
      </div>
      ${QuejasCard(user)}
      <div class="card">
        <div class="card-title">Cuenta</div>
        <div class="spacer"></div>
        <button class="btn btn-danger" data-act="logout">Cerrar sesión</button>
      </div>
    `;
  }

  function QuejasCard(user) {
    const mis = DB.quejas
      .filter(q => q.usuarioId === user.id)
      .sort((a,b) => b.creadoEn - a.creadoEn);
    return `
      <div class="card">
        <div class="card-title">📖 Libro de Quejas</div>
        <p class="muted" style="font-size:13px; margin-top:4px">Dejá tu comentario, reclamo o sugerencia. Lo verá el administrador.</p>
        <div class="spacer"></div>
        <form id="queja-form" class="stack">
          <div class="field">
            <label>Tu mensaje</label>
            <textarea class="input" name="texto" rows="4" required placeholder="Escribí acá tu queja o sugerencia…" style="min-height:100px; padding:10px; font-family:inherit"></textarea>
          </div>
          <button class="btn btn-primary" type="submit">Enviar</button>
        </form>
        ${mis.length ? `
          <div class="spacer"></div>
          <div class="muted" style="font-weight:700; font-size:13px; margin-bottom:8px">Mis mensajes enviados</div>
          <div class="stack">
            ${mis.map(q => `
              <div class="list-item">
                <div style="flex:1; min-width:0">
                  <div style="font-size:14px; white-space:pre-wrap">${escapeHtml(q.texto)}</div>
                  <div class="muted" style="font-size:11px; margin-top:4px">${new Date(q.creadoEn).toLocaleString('es-AR')}</div>
                </div>
                <button class="btn btn-danger btn-sm" data-del-queja="${q.id}">Eliminar</button>
              </div>`).join('')}
          </div>` : ''}
      </div>
    `;
  }

  function ViewAdmin(user) {
    const usuarios = DB.usuarios;
    const viajes = DB.viajes.slice().sort((a,b) => b.fecha.localeCompare(a.fecha));
    return `
      <h2 class="section-title">Panel administrativo</h2>
      <p class="section-sub">Gestioná días de viaje, usuarios y prioridades. (Ida ${HORARIO_IDA} · Vuelta ${HORARIO_VUELTA} fijas)</p>

      <div class="card">
        <div class="card-header"><div class="card-title">➕ Habilitar día de viaje</div></div>
        <form id="trip-form" class="stack">
          <div class="row">
            <div class="field" style="flex:1; min-width:140px"><label>Fecha</label><input class="input" type="date" name="fecha" required value="${ymd(new Date())}" /></div>
            <div class="field" style="flex:1; min-width:120px"><label>Capacidad</label><input class="input" type="number" name="capacidad" required value="24" min="1" max="60" /></div>
          </div>
          <button class="btn btn-primary" type="submit">Crear día</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">🚌 Días habilitados (${viajes.length})</div>
        <div class="spacer"></div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Cupos</th><th>Ocup.</th><th></th></tr></thead>
            <tbody>
              ${viajes.map(v => {
                const c = DB.reservas.filter(r => r.viajeId===v.id && r.estado==='confirmada').length;
                return `<tr>
                  <td>${escapeHtml(v.fecha)}</td>
                  <td>${v.capacidad}</td>
                  <td>${c}/${v.capacidad}</td>
                  <td style="text-align:right"><button class="btn btn-danger btn-sm" data-del-trip="${v.id}">Eliminar</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title">👥 Usuarios (${usuarios.length})</div>
        <div class="spacer"></div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr><th>Nombre</th><th>Sector</th><th>Email</th><th>Prioridad</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              ${usuarios.map(u => `
                <tr>
                  <td>${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}</td>
                  <td>${escapeHtml(u.sector)}</td>
                  <td class="muted">${escapeHtml(u.email)}</td>
                  <td>
                    <select class="select" data-prio="${u.id}" style="padding:6px 10px; font-size:13px">
                      ${[1,2,3].map(p => `<option value="${p}" ${u.prioridad===p?'selected':''}>P${p}${p===3?' (alta)':p===2?' (media)':' (normal)'}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="badge ${u.rol==='admin'?'brand':''}">${u.rol}</span></td>
                  <td style="text-align:right">${u.id !== user.id ? `<button class="btn btn-danger btn-sm" data-del-user="${u.id}">Eliminar</button>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${AdminQuejasCard()}
    `;
  }

  function AdminQuejasCard() {
    const quejas = DB.quejas.slice().sort((a,b) => b.creadoEn - a.creadoEn);
    return `
      <div class="card">
        <div class="card-title">📖 Libro de Quejas (${quejas.length})</div>
        <div class="spacer"></div>
        ${quejas.length ? `<div class="stack">${quejas.map(q => {
          const u = DB.usuarios.find(x => x.id === q.usuarioId);
          const nombre = u ? `${u.nombre} ${u.apellido}` : 'Usuario eliminado';
          const sector = u ? u.sector : '';
          return `
            <div class="list-item">
              <div style="flex:1; min-width:0">
                <div style="font-weight:600; font-size:14px">${escapeHtml(nombre)}${sector ? ` · <span class="muted">${escapeHtml(sector)}</span>` : ''}</div>
                <div style="font-size:14px; margin-top:4px; white-space:pre-wrap">${escapeHtml(q.texto)}</div>
                <div class="muted" style="font-size:11px; margin-top:4px">${new Date(q.creadoEn).toLocaleString('es-AR')}</div>
              </div>
              <button class="btn btn-danger btn-sm" data-del-queja="${q.id}">Eliminar</button>
            </div>`;
        }).join('')}</div>` : '<p class="muted">Sin mensajes por ahora.</p>'}
      </div>
    `;
  }

  // ---------- Bindings ----------
  function bindShell() {
    document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
    document.querySelectorAll('[data-act="theme"]').forEach(b => b.addEventListener('click', () => { toggleTheme(); render(); }));
    document.querySelectorAll('[data-act="logout"]').forEach(b => b.addEventListener('click', () => { if (confirm('¿Cerrar sesión?')) logout(); }));
  }

  function bindAuth() {
    const tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('auth-body').innerHTML = t.dataset.tab === 'login' ? LoginForm() : RegisterForm();
      bindAuthForms();
    }));
    bindAuthForms();
  }
  function bindAuthForms() {
    const lf = document.getElementById('login-form');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(lf));
      const r = login(data.email.trim(), data.password);
      if (!r.ok) return toast(r.error, 'bad');
      toast('¡Bienvenido!'); render();
    });
    const rf = document.getElementById('register-form');
    if (rf) rf.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(rf));
      Object.keys(data).forEach(k => typeof data[k] === 'string' && (data[k] = data[k].trim()));
      const r = register(data);
      if (!r.ok) return toast(r.error, 'bad');
      toast('Cuenta creada 🎉'); render();
    });
  }

  function bindView(user) {
    document.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => {
      const r = reservar(b.dataset.book, user.id);
      if (!r.ok) return toast(r.error, 'bad');
      const v = DB.viajes.find(x => x.id === b.dataset.book);
      const label = v && v.tipo === 'vuelta' ? `Vuelta ${HORARIO_VUELTA}` : `Ida ${HORARIO_IDA}`;
      toast(r.reserva.estado === 'confirmada' ? `${label} reservada` : `${label} · en lista de espera (#${r.reserva.orden - v.capacidad})`);
      render();
    }));
    document.querySelectorAll('[data-book-day]').forEach(b => b.addEventListener('click', () => {
      const fecha = b.dataset.bookDay;
      const sel = document.querySelector(`input[name="opt-${fecha}"]:checked`);
      if (!sel) return toast('Elegí una opción', 'bad');
      const svcSel = document.querySelector(`input[name="svc-${fecha}"]:checked`);
      const tipoServicio = svcSel ? svcSel.value : 'normal';
      const r = reservarOpcion(fecha, user.id, sel.value, tipoServicio);
      if (!r.ok) return toast(r.error, 'bad');
      const nombres = { ida: 'Solo ida', vuelta: 'Solo vuelta', ambos: 'Ida y vuelta' };
      const svcLabel = tipoServicio === 'prioridad' ? ' · Prioridad ⭐' : '';
      toast(`Reserva confirmada · ${nombres[sel.value]}${svcLabel}`);
      render();
    }));
    document.querySelectorAll('[data-day]').forEach(el => el.addEventListener('click', () => navigate('home')));
    document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Cancelar esta reserva?')) return;
      cancelar(b.dataset.cancel); toast('Reserva cancelada'); render();
    }));

    const pf = document.getElementById('profile-form');
    if (pf) pf.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(pf));
      DB.usuarios = DB.usuarios.map(u => u.id === user.id ? { ...u, ...data } : u);
      toast('Perfil actualizado'); render();
    });

    const tf = document.getElementById('trip-form');
    if (tf) tf.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(tf));
      if (DB.viajes.some(v => v.fecha === data.fecha)) { toast('Ya existe un día habilitado para esa fecha', 'bad'); return; }
      const cap = Number(data.capacidad);
      DB.viajes = [...DB.viajes,
        { id: uid(), fecha: data.fecha, tipo: 'ida', horario: HORARIO_IDA, origen: ORIGEN_IDA, destino: DESTINO_IDA, capacidad: cap, creadoEn: Date.now() },
        { id: uid(), fecha: data.fecha, tipo: 'vuelta', horario: HORARIO_VUELTA, origen: ORIGEN_VUELTA, destino: DESTINO_VUELTA, capacidad: cap, creadoEn: Date.now() },
      ];
      toast('Día habilitado (ida + vuelta)'); render();
    });
    document.querySelectorAll('[data-del-trip]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Eliminar este día (ida + vuelta) y todas sus reservas?')) return;
      const id = b.dataset.delTrip;
      const v = DB.viajes.find(x => x.id === id);
      const fecha = v ? v.fecha : null;
      const idsBorrar = fecha ? DB.viajes.filter(x => x.fecha === fecha).map(x => x.id) : [id];
      DB.viajes = DB.viajes.filter(x => !idsBorrar.includes(x.id));
      DB.reservas = DB.reservas.filter(r => !idsBorrar.includes(r.viajeId));
      toast('Día eliminado'); render();
    }));
    document.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Eliminar este usuario y sus reservas?')) return;
      const id = b.dataset.delUser;
      DB.usuarios = DB.usuarios.filter(u => u.id !== id);
      const viajesAfectados = [...new Set(DB.reservas.filter(r => r.usuarioId === id).map(r => r.viajeId))];
      DB.reservas = DB.reservas.filter(r => r.usuarioId !== id);
      viajesAfectados.forEach(vid => recomputarOrdenes(vid));
      toast('Usuario eliminado'); render();
    }));
    document.querySelectorAll('[data-prio]').forEach(s => s.addEventListener('change', () => {
      const id = s.dataset.prio;
      DB.usuarios = DB.usuarios.map(u => u.id === id ? { ...u, prioridad: Number(s.value) } : u);
      const viajesAfectados = [...new Set(DB.reservas.filter(r => r.usuarioId === id).map(r => r.viajeId))];
      DB.reservas = DB.reservas.map(r => r.usuarioId === id ? { ...r, prioridad: Number(s.value) } : r);
      viajesAfectados.forEach(vid => recomputarOrdenes(vid));
      toast('Prioridad actualizada'); render();
    }));

    const qf = document.getElementById('queja-form');
    if (qf) qf.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(qf));
      const texto = String(data.texto || '').trim();
      if (!texto) return toast('Escribí un mensaje', 'bad');
      DB.quejas = [...DB.quejas, { id: uid(), usuarioId: user.id, texto, creadoEn: Date.now() }];
      toast('Mensaje enviado 📖'); render();
    });
    document.querySelectorAll('[data-del-queja]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Eliminar este mensaje?')) return;
      DB.quejas = DB.quejas.filter(q => q.id !== b.dataset.delQueja);
      toast('Mensaje eliminado'); render();
    }));
  }

  // ---------- Icons ----------
  function iconHome(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`}
  function iconCalendar(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`}
  function iconList(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`}
  function iconStats(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/></svg>`}
  function iconUser(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>`}
  function iconAdmin(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>`}
  function iconLogout(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M15 17l5-5-5-5M20 12H9M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/></svg>`}
  function sun(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`}
  function moon(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`}

  // ---------- Boot ----------
  initTheme();
  seed();
  render();
})();
