const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

function uid() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
function now() { return Date.now(); }

function newMatchState() {
  return {
    status: "waiting",
    matchId: uid(),
    teams: [
      { name: "TAKIM A", players: ["Oyuncu A1", "Oyuncu A2"] },
      { name: "TAKIM B", players: ["Oyuncu B1", "Oyuncu B2"] }
    ],
    points: [0, 0],
    games: [0, 0],
    sets: [0, 0],
    setScores: [],
    tiebreak: false,
    tiebreakPoints: [0, 0],
    serviceOrder: [0, 2, 1, 3],
    servicePos: 0,
    tiebreakStartServicePos: null,
    goldenPoint: false,
    bestOf: 3,
    bookingMinutes: 90,
    startedAt: null,
    endedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    sidesSwapped: false,
    winner: null,
    log: []
  };
}

function newCourt(id, name) {
  return {
    id: String(id),
    name: name || `Kort ${id}`,
    active: true,
    match: newMatchState(),
    history: []
  };
}

let db = { version: 1, courts: [newCourt(1), newCourt(2), newCourt(3), newCourt(4)] };
const undoStacks = new Map();
const clients = new Map();

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (parsed && Array.isArray(parsed.courts)) db = parsed;
    }
  } catch (e) {
    console.error("data.json okunamadı:", e.message);
  }
}
function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("data.json yazılamadı:", e.message);
  }
}
load();

function getCourt(id) {
  return db.courts.find(c => String(c.id) === String(id));
}
function getPlayerByGlobalId(match, gid) {
  const map = [
    { team: 0, player: 0 },
    { team: 0, player: 1 },
    { team: 1, player: 0 },
    { team: 1, player: 1 }
  ];
  const p = map[gid] || map[0];
  return { ...p, name: match.teams[p.team].players[p.player] || `Oyuncu ${gid+1}` };
}
function currentServer(match) {
  const gid = match.serviceOrder[match.servicePos] ?? 0;
  return { gid, ...getPlayerByGlobalId(match, gid) };
}
function setsNeeded(match) { return match.bestOf === 1 ? 1 : 2; }
function scoreLabel(match, team) {
  if (match.tiebreak) return String(match.tiebreakPoints[team]);
  const a = match.points[team], b = match.points[1-team];
  if (a <= 2) return ["0", "15", "30"][a];
  if (a === 3 && b <= 3) return "40";
  if (a >= 3 && b >= 3) {
    if (a === b) return "40";
    if (a === b + 1) return "ADV";
    if (b === a + 1) return "40";
  }
  return a >= 3 ? "40" : ["0", "15", "30"][a];
}
function summarizeCourt(court) {
  const m = court.match;
  const srv = currentServer(m);
  return {
    id: court.id,
    name: court.name,
    active: court.active,
    status: m.status,
    matchId: m.matchId,
    teams: m.teams,
    points: m.points,
    pointLabels: [scoreLabel(m,0), scoreLabel(m,1)],
    games: m.games,
    sets: m.sets,
    setScores: m.setScores,
    tiebreak: m.tiebreak,
    tiebreakPoints: m.tiebreakPoints,
    goldenPoint: m.goldenPoint,
    bestOf: m.bestOf,
    bookingMinutes: m.bookingMinutes,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    pausedAt: m.pausedAt,
    pausedTotalMs: m.pausedTotalMs,
    sidesSwapped: m.sidesSwapped,
    winner: m.winner,
    currentServer: srv,
    serviceOrder: m.serviceOrder,
    servicePos: m.servicePos,
    log: m.log.slice(-25),
    history: court.history.slice(-20)
  };
}

function broadcast(courtId) {
  const set = clients.get(String(courtId));
  if (!set || !set.size) return;
  const court = getCourt(courtId);
  if (!court) return;
  const payload = `data: ${JSON.stringify(summarizeCourt(court))}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
}
function broadcastAll() {
  db.courts.forEach(c => broadcast(c.id));
}

function pushUndo(court) {
  const key = String(court.id);
  if (!undoStacks.has(key)) undoStacks.set(key, []);
  const stack = undoStacks.get(key);
  stack.push(deepClone(court.match));
  if (stack.length > 100) stack.shift();
}

function logAction(match, type, text) {
  match.log.push({ at: now(), type, text });
  if (match.log.length > 100) match.log.shift();
}

function ensureLive(match) {
  if (match.status === "waiting") {
    match.status = "live";
    match.startedAt = now();
    logAction(match, "start", "Maç başladı");
  }
}
function archiveIfNeeded(court) {
  const m = court.match;
  if (m.status !== "finished" || m.archived) return;
  court.history.push({
    matchId: m.matchId,
    teams: deepClone(m.teams),
    sets: [...m.sets],
    setScores: deepClone(m.setScores),
    winner: m.winner,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    goldenPoint: m.goldenPoint,
    bestOf: m.bestOf
  });
  if (court.history.length > 50) court.history.shift();
  m.archived = true;
}

function winMatch(court, team) {
  const m = court.match;
  m.status = "finished";
  m.winner = team;
  m.endedAt = now();
  m.pausedAt = null;
  logAction(m, "match", `${m.teams[team].name} maçı kazandı`);
  archiveIfNeeded(court);
}

function finishSet(court, team, fromTiebreak) {
  const m = court.match;
  m.setScores.push([m.games[0], m.games[1]]);
  m.sets[team]++;
  logAction(m, "set", `${m.teams[team].name} seti kazandı: ${m.games[0]}-${m.games[1]}`);

  if (m.sets[team] >= setsNeeded(m)) {
    m.points = [0,0];
    m.tiebreak = false;
    m.tiebreakPoints = [0,0];
    m.tiebreakStartServicePos = null;
    winMatch(court, team);
    return;
  }

  if (fromTiebreak && m.tiebreakStartServicePos !== null) {
    m.servicePos = (m.tiebreakStartServicePos + 1) % m.serviceOrder.length;
  }

  m.points = [0,0];
  m.games = [0,0];
  m.tiebreak = false;
  m.tiebreakPoints = [0,0];
  m.tiebreakStartServicePos = null;
}

function winGame(court, team) {
  const m = court.match;
  m.games[team]++;
  m.points = [0,0];
  const serverBefore = currentServer(m).name;
  logAction(m, "game", `${m.teams[team].name} game aldı (${m.games[0]}-${m.games[1]}), servis: ${serverBefore}`);
  m.servicePos = (m.servicePos + 1) % m.serviceOrder.length;

  const g = m.games[team], o = m.games[1-team];
  if (g >= 6 && g - o >= 2) {
    finishSet(court, team, false);
  } else if (m.games[0] === 6 && m.games[1] === 6) {
    m.tiebreak = true;
    m.tiebreakPoints = [0,0];
    m.tiebreakStartServicePos = m.servicePos;
    logAction(m, "tiebreak", "Tie-break başladı");
  }
}

function awardPoint(court, team) {
  const m = court.match;
  if (m.status === "finished") return;
  ensureLive(m);
  if (m.pausedAt) return;

  if (m.tiebreak) {
    m.tiebreakPoints[team]++;
    const a = m.tiebreakPoints[team], b = m.tiebreakPoints[1-team];
    const total = m.tiebreakPoints[0] + m.tiebreakPoints[1];
    logAction(m, "point", `${m.teams[team].name} tie-break puanı (${m.tiebreakPoints[0]}-${m.tiebreakPoints[1]})`);

    if (a >= 7 && a - b >= 2) {
      m.games[team] = 7;
      finishSet(court, team, true);
      return;
    }
    if (total === 1 || (total > 1 && total % 2 === 1)) {
      m.servicePos = (m.servicePos + 1) % m.serviceOrder.length;
    }
    return;
  }

  m.points[team]++;
  logAction(m, "point", `${m.teams[team].name} puan aldı`);
  const p = m.points[team], opp = m.points[1-team];
  const standardWin = p >= 4 && (p - opp) >= 2;
  const goldenWin = m.goldenPoint && p >= 4 && opp >= 3;
  if (standardWin || goldenWin) winGame(court, team);
}

function resetMatch(court, setup = {}) {
  const m = newMatchState();
  m.teams = setup.teams || m.teams;
  m.goldenPoint = !!setup.goldenPoint;
  m.bestOf = Number(setup.bestOf) === 1 ? 1 : 3;
  m.bookingMinutes = Math.max(15, Math.min(300, Number(setup.bookingMinutes) || 90));
  if (Array.isArray(setup.serviceOrder) && setup.serviceOrder.length === 4) {
    const uniq = [...new Set(setup.serviceOrder.map(Number))];
    if (uniq.length === 4 && uniq.every(n => n >= 0 && n <= 3)) m.serviceOrder = uniq;
  }
  m.servicePos = Math.max(0, Math.min(3, Number(setup.servicePos) || 0));
  court.match = m;
  undoStacks.set(String(court.id), []);
}

function updateSetup(court, setup) {
  const m = court.match;
  // Takım/oyuncu isimleri ve maç ayarları gerektiğinde canlı maçta da düzeltilebilir.
  if (setup.teams) {
    for (let t=0;t<2;t++) {
      if (setup.teams[t]) {
        m.teams[t].name = String(setup.teams[t].name || m.teams[t].name).slice(0,32);
        if (Array.isArray(setup.teams[t].players)) {
          m.teams[t].players = [
            String(setup.teams[t].players[0] || m.teams[t].players[0]).slice(0,32),
            String(setup.teams[t].players[1] || m.teams[t].players[1]).slice(0,32)
          ];
        }
      }
    }
  }
  if ("goldenPoint" in setup) m.goldenPoint = !!setup.goldenPoint;
  if ("bestOf" in setup) m.bestOf = Number(setup.bestOf) === 1 ? 1 : 3;
  if ("bookingMinutes" in setup) m.bookingMinutes = Math.max(15, Math.min(300, Number(setup.bookingMinutes) || 90));
  if (Array.isArray(setup.serviceOrder) && setup.serviceOrder.length === 4) {
    const uniq = [...new Set(setup.serviceOrder.map(Number))];
    if (uniq.length === 4 && uniq.every(n => n >= 0 && n <= 3)) m.serviceOrder = uniq;
  }
  if ("servicePos" in setup) m.servicePos = Math.max(0, Math.min(3, Number(setup.servicePos) || 0));
}

function applyAction(court, body) {
  const action = body.action;
  const m = court.match;

  const snapshotActions = new Set(["point","swap","pause","resume","setServer","setup","start"]);
  if (snapshotActions.has(action)) pushUndo(court);

  if (action === "point") {
    const team = Number(body.team);
    if (team === 0 || team === 1) awardPoint(court, team);
  } else if (action === "undo") {
    const stack = undoStacks.get(String(court.id)) || [];
    const prev = stack.pop();
    if (prev) court.match = prev;
  } else if (action === "swap") {
    m.sidesSwapped = !m.sidesSwapped;
    logAction(m, "system", "Ekran tarafları değiştirildi");
  } else if (action === "pause") {
    if (m.status === "live" && !m.pausedAt) {
      m.pausedAt = now();
      logAction(m, "system", "Maç saati duraklatıldı");
    }
  } else if (action === "resume") {
    if (m.status === "live" && m.pausedAt) {
      m.pausedTotalMs += now() - m.pausedAt;
      m.pausedAt = null;
      logAction(m, "system", "Maç saati devam ettirildi");
    }
  } else if (action === "setServer") {
    const pos = Number(body.servicePos);
    if (pos >= 0 && pos <= 3) {
      m.servicePos = pos;
      logAction(m, "system", `Servis ${currentServer(m).name} olarak ayarlandı`);
    }
  } else if (action === "setup") {
    updateSetup(court, body.setup || {});
  } else if (action === "start") {
    updateSetup(court, body.setup || {});
    ensureLive(m);
  } else if (action === "newMatch") {
    resetMatch(court, body.setup || {});
  } else if (action === "renameCourt") {
    court.name = String(body.name || court.name).slice(0,40);
  } else if (action === "toggleCourt") {
    court.active = !court.active;
  }
  archiveIfNeeded(court);
  persist();
  broadcast(court.id);
  return summarizeCourt(court);
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}
function text(res, status, body, type="text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control":"no-store" });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}
function serveStatic(req, res, pathname) {
  let file = pathname === "/" ? "/index.html" : pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR)) return text(res, 403, "Forbidden");
  fs.readFile(full, (err, data) => {
    if (err) return text(res, 404, "Not found");
    const ext = path.extname(full).toLowerCase();
    const types = {
      ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
      ".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",
      ".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon"
    };
    res.writeHead(200, {"Content-Type":types[ext] || "application/octet-stream"});
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = u.pathname;

  if (pathname === "/api/courts" && req.method === "GET") {
    return json(res, 200, db.courts.map(c => summarizeCourt(c)));
  }

  if (pathname === "/api/courts" && req.method === "POST") {
    const body = await readBody(req);
    const maxId = db.courts.reduce((m,c) => Math.max(m, Number(c.id)||0), 0);
    const c = newCourt(maxId + 1, String(body.name || `Kort ${maxId+1}`).slice(0,40));
    db.courts.push(c);
    persist();
    return json(res, 201, summarizeCourt(c));
  }

  const courtMatch = pathname.match(/^\/api\/court\/([^/]+)$/);
  if (courtMatch && req.method === "GET") {
    const c = getCourt(courtMatch[1]);
    return c ? json(res, 200, summarizeCourt(c)) : json(res, 404, {error:"Court not found"});
  }

  const actionMatch = pathname.match(/^\/api\/court\/([^/]+)\/action$/);
  if (actionMatch && req.method === "POST") {
    const c = getCourt(actionMatch[1]);
    if (!c) return json(res, 404, {error:"Court not found"});
    const body = await readBody(req);
    try {
      return json(res, 200, applyAction(c, body));
    } catch (e) {
      console.error(e);
      return json(res, 500, {error:e.message});
    }
  }

  if (pathname === "/events" && req.method === "GET") {
    const courtId = String(u.searchParams.get("court") || "");
    const c = getCourt(courtId);
    if (!c) return json(res, 404, {error:"Court not found"});
    res.writeHead(200, {
      "Content-Type":"text/event-stream",
      "Cache-Control":"no-cache",
      "Connection":"keep-alive",
      "Access-Control-Allow-Origin":"*"
    });
    res.write(`data: ${JSON.stringify(summarizeCourt(c))}\n\n`);
    if (!clients.has(courtId)) clients.set(courtId, new Set());
    clients.get(courtId).add(res);
    const heartbeat = setInterval(() => {
      try { res.write(`: ping ${Date.now()}\n\n`); } catch {}
    }, 20000);
    req.on("close", () => {
      clearInterval(heartbeat);
      const set = clients.get(courtId);
      if (set) set.delete(res);
    });
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  console.log("");
  console.log("==============================================");
  console.log("  GLASS SCORE çalışıyor");
  console.log(`  Bu bilgisayar: http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Aynı Wi‑Fi cihazları: http://${ip}:${PORT}`));
  console.log("==============================================");
  console.log("");
});
