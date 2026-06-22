/* MiniBus Zavalla — Vanilla JS app
 * Storage: localStorage (claves: mb_usuarios, mb_viajes, mb_reservas, mb_session, mb_theme)
 * Arquitectura modular por vistas. Sin frameworks.
 */
(() => {
  'use strict';

  // ---------- Storage helpers (simulan archivos JSON) ----------
  const KEYS = {
    usuarios: 'mb_usuarios',
    viajes: 'mb_viajes',
    reservas: 'mb_reservas',
    session: 'mb_session',
    theme: 'mb_theme',
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
      for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        viajes.push({
          id: uid(),
          fecha: ymd(d),
          horario: '17:30',
          origen: 'Rosario (Oficina)',
          destino: 'Zavalla',
          capacidad: 25,
          creadoEn: Date.now(),
        });
      }
      DB.viajes = viajes;
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
    toast._t = setTimeout(() => { el.className = 'toast'; }, 2400);
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
    // Ordenar por prioridad desc, luego por creación asc
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
  function reservar(viajeId, usuarioId) {
    const u = DB.usuarios.find(x => x.id === usuarioId);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    if (DB.reservas.some(r => r.viajeId === viajeId && r.usuarioId === usuarioId)) {
      return { ok: false, error: 'Ya tenés una reserva en este viaje' };
    }
    DB.reservas = [...DB.reservas, {
      id: uid(), viajeId, usuarioId,
      prioridad: u.prioridad || 1,
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
    const t = localStorage.getItem(KEYS.theme) || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEYS.theme, next);
  }

  // ---------- Render ----------
  const $ = (sel, el = document) => el.querySelector(sel);
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
          <div class="brand-mark">M</div>
          <div>
            <div style="font-size:15px">MiniBus Zavalla</div>
            <div class="muted" style="font-size:11px; font-weight:500">Rosario → Zavalla</div>
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
            <div class="brand-mark">M</div>
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

  function ViewHome(user) {
    const todayStr = ymd(new Date());
    const proximos = DB.viajes
      .filter(v => v.fecha >= todayStr)
      .sort((a,b) => a.fecha.localeCompare(b.fecha));
    const viajeHoy = proximos[0];
    if (!viajeHoy) {
      return `
        <h2 class="section-title">Hola, ${escapeHtml(user.nombre)} 👋</h2>
        <p class="section-sub">No hay viajes programados próximamente.</p>
        ${user.rol === 'admin' ? `<button class="btn btn-primary" data-nav="admin">Crear un viaje</button>` : ''}`;
    }
    return `
      <h2 class="section-title">Hola, ${escapeHtml(user.nombre)} 👋</h2>
      <p class="section-sub">Tu próximo viaje a Zavalla.</p>
      ${TripFullCard(viajeHoy, user)}
      ${proximos.length > 1 ? `
        <div class="spacer"></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Próximos viajes</div>
            <button class="btn btn-ghost btn-sm" data-nav="trips">Ver todos</button>
          </div>
          <div class="stack">
            ${proximos.slice(1, 4).map(v => TripMiniCard(v, user)).join('')}
          </div>
        </div>` : ''}
    `;
  }

  function TripFullCard(viaje, user) {
    const rs = reservasDeViaje(viaje.id);
    const conf = rs.filter(r => r.estado === 'confirmada');
    const espera = rs.filter(r => r.estado === 'espera');
    const miReserva = rs.find(r => r.usuarioId === user.id);
    const ocupacion = Math.min(100, Math.round((conf.length / viaje.capacidad) * 100));
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(fmtDateLong(viaje.fecha))}</div>
            <div class="muted" style="font-size:13px; margin-top:4px">
              🕒 ${escapeHtml(viaje.horario)} · ${escapeHtml(viaje.origen)} → ${escapeHtml(viaje.destino)}
            </div>
          </div>
          <span class="badge ${conf.length >= viaje.capacidad ? 'bad' : 'ok'}">${conf.length}/${viaje.capacidad}</span>
        </div>
        <div class="occupancy-bar"><span style="width:${ocupacion}%"></span></div>
        <div class="spacer"></div>
        ${SeatMap(viaje, rs, user)}
        <div class="spacer"></div>
        ${miReserva ? `
          <div class="list-item is-me">
            <div class="order">${miReserva.orden}</div>
            <div style="flex:1">
              <div style="font-weight:700">Tu reserva</div>
              <div class="muted" style="font-size:12px">
                ${miReserva.estado === 'confirmada' ? `Asiento confirmado · Orden #${miReserva.orden}` : `En lista de espera · Posición ${miReserva.orden - viaje.capacidad}`}
              </div>
            </div>
            <button class="btn btn-danger btn-sm" data-cancel="${miReserva.id}">Cancelar</button>
          </div>
        ` : `
          <button class="btn btn-primary btn-block" data-book="${viaje.id}">
            ${conf.length >= viaje.capacidad ? '⏳ Anotarme en lista de espera' : '🎟️ Reservar mi asiento'}
          </button>
        `}
        <div class="spacer"></div>
        <details>
          <summary class="muted" style="cursor:pointer; font-weight:600">Ver lista de pasajeros (${rs.length})</summary>
          <div class="list" style="margin-top:10px">
            ${conf.map(r => PassengerItem(r, user, false)).join('') || '<p class="muted">Aún no hay confirmados</p>'}
            ${espera.length ? `<div class="muted" style="font-size:12px; margin:8px 4px 4px; font-weight:600">Lista de espera</div>` : ''}
            ${espera.map(r => PassengerItem(r, user, true)).join('')}
          </div>
        </details>
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
    // 25 asientos: 5 filas x 5 columnas (asiento 3 de cada fila es pasillo en el medio? haremos layout 2-1(pasillo)-2 con 5 cols visuales, mostrando 25 asientos en 5x5 simple para simplificad)
    // Usamos 5x5 plano, 25 seats. Pasillo no se modela para no perder asientos.
    const seats = [];
    const confirmadas = reservas.filter(r => r.estado === 'confirmada');
    const yoTengo = reservas.find(r => r.usuarioId === user.id);
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
      } else if (!yoTengo) {
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

  function TripMiniCard(viaje, user) {
    const rs = reservasDeViaje(viaje.id);
    const conf = rs.filter(r => r.estado === 'confirmada').length;
    const mio = rs.find(r => r.usuarioId === user.id);
    return `
      <div class="trip-card" data-trip="${viaje.id}">
        <div class="trip-date">
          <div class="day">${fmtDay(viaje.fecha)}</div>
          <div class="month">${fmtMonth(viaje.fecha).replace('.','')}</div>
        </div>
        <div class="trip-meta">
          <div class="t1">${escapeHtml(fmtDateLong(viaje.fecha))}</div>
          <div class="t2">🕒 ${escapeHtml(viaje.horario)} · ${conf}/${viaje.capacidad} ocupados</div>
          <div class="occupancy-bar"><span style="width:${Math.min(100, (conf/viaje.capacidad)*100)}%"></span></div>
        </div>
        ${mio ? `<span class="badge ${mio.estado==='confirmada'?'ok':'warn'}">${mio.estado==='confirmada'?'Reservado':'En espera'}</span>` : ''}
      </div>`;
  }

  function ViewTrips(user) {
    const hoy = ymd(new Date());
    const futuros = DB.viajes.filter(v => v.fecha >= hoy).sort((a,b) => a.fecha.localeCompare(b.fecha));
    const semana = buildWeek(futuros);
    return `
      <h2 class="section-title">Calendario semanal</h2>
      <p class="section-sub">Vista de los próximos 7 días.</p>
      <div class="calendar">${semana.map(d => CalDay(d)).join('')}</div>
      <div class="spacer"></div>
      <h3 class="section-title" style="font-size:18px">Próximos viajes</h3>
      <div class="stack">
        ${futuros.length ? futuros.map(v => TripMiniCard(v, user)).join('') : `<div class="empty"><div class="em">📭</div>No hay viajes programados</div>`}
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
          <div class="muted" style="font-size:11px">${escapeHtml(viaje.horario)}</div>
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
              <div style="font-weight:600">${escapeHtml(fmtDateLong(r.viaje.fecha))}</div>
              <div class="muted" style="font-size:12px">${escapeHtml(r.viaje.horario)} · ${escapeHtml(r.viaje.origen)} → ${escapeHtml(r.viaje.destino)}</div>
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

    // Ranking de asistencia
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

    // Días con mayor demanda
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
      <div class="card">
        <div class="card-title">Cuenta</div>
        <div class="spacer"></div>
        <button class="btn btn-danger" data-act="logout">Cerrar sesión</button>
      </div>
    `;
  }

  function ViewAdmin(user) {
    const usuarios = DB.usuarios;
    const viajes = DB.viajes.slice().sort((a,b) => b.fecha.localeCompare(a.fecha));
    return `
      <h2 class="section-title">Panel administrativo</h2>
      <p class="section-sub">Gestioná viajes, usuarios y prioridades.</p>

      <div class="card">
        <div class="card-header"><div class="card-title">➕ Crear viaje</div></div>
        <form id="trip-form" class="stack">
          <div class="row">
            <div class="field" style="flex:1; min-width:140px"><label>Fecha</label><input class="input" type="date" name="fecha" required value="${ymd(new Date())}" /></div>
            <div class="field" style="flex:1; min-width:120px"><label>Horario</label><input class="input" type="time" name="horario" required value="17:30" /></div>
            <div class="field" style="flex:1; min-width:120px"><label>Capacidad</label><input class="input" type="number" name="capacidad" required value="25" min="1" max="60" /></div>
          </div>
          <div class="row">
            <div class="field" style="flex:1; min-width:140px"><label>Origen</label><input class="input" name="origen" value="Rosario (Oficina)" /></div>
            <div class="field" style="flex:1; min-width:140px"><label>Destino</label><input class="input" name="destino" value="Zavalla" /></div>
          </div>
          <button class="btn btn-primary" type="submit">Crear viaje</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">🚌 Viajes (${viajes.length})</div>
        <div class="spacer"></div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Cupos</th><th>Ocup.</th><th></th></tr></thead>
            <tbody>
              ${viajes.map(v => {
                const c = DB.reservas.filter(r => r.viajeId===v.id && r.estado==='confirmada').length;
                return `<tr>
                  <td>${escapeHtml(v.fecha)}</td>
                  <td>${escapeHtml(v.horario)}</td>
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
      toast(r.reserva.estado === 'confirmada' ? `Asiento #${r.reserva.orden} reservado` : `Estás en lista de espera (#${r.reserva.orden - DB.viajes.find(v=>v.id===b.dataset.book).capacidad})`);
      render();
    }));
    document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Cancelar tu reserva?')) return;
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
      DB.viajes = [...DB.viajes, {
        id: uid(), fecha: data.fecha, horario: data.horario,
        origen: data.origen, destino: data.destino,
        capacidad: Number(data.capacidad), creadoEn: Date.now(),
      }];
      toast('Viaje creado'); render();
    });
    document.querySelectorAll('[data-del-trip]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Eliminar este viaje y todas sus reservas?')) return;
      const id = b.dataset.delTrip;
      DB.viajes = DB.viajes.filter(v => v.id !== id);
      DB.reservas = DB.reservas.filter(r => r.viajeId !== id);
      toast('Viaje eliminado'); render();
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
    document.querySelectorAll('[data-trip]').forEach(el => el.addEventListener('click', () => {
      // Mostrar detalle: por simplicidad, navegamos a home y dejamos próximos arriba
      // (mantenemos comportamiento sin modal completo)
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
