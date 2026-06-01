const PAL = [
  {id:'t1',s:'#C4856A'},{id:'t2',s:'#8B1C22'},{id:'t3',s:'#FF819C'},
  {id:'t4',s:'#9EC0EB'},{id:'t5',s:'#BB8588'},{id:'t6',s:'#8BA3C5'},
  {id:'t7',s:'#CA7C4C'},{id:'t8',s:'#B37AD4'},{id:'t9',s:'#D39858'},
  {id:'t10',s:'#7F0303'},{id:'t11',s:'#575527'},{id:'t12',s:'#5AA371'},
]
const PAL_MIGRATE = {film:'t1',academia:'t2',candy:'t3',hydrangea:'t4',peony:'t5',arctic:'t6',vintage:'t7',ocean:'t8',amber:'t9',nautical:'t10',matcha:'t11',jungle:'t12'}
let curPal = localStorage.getItem('mt_pal') || 't1'
if (PAL_MIGRATE[curPal]) { curPal = PAL_MIGRATE[curPal]; localStorage.setItem('mt_pal', curPal) }

function applyTheme(id) {
  document.body.classList.forEach(c => { if (c.startsWith('p-')) document.body.classList.remove(c) })
  document.body.classList.add(`p-${id}`)
  curPal = id
  localStorage.setItem('mt_pal', id)
  document.querySelectorAll('.sw').forEach(e => e.classList.toggle('on', e.dataset.k === id))
  document.getElementById('hdr').style.background = ''
  renderAll(); renderHeader()
}

function shuffleTheme() {
  const pick = PAL[Math.floor(Math.random() * PAL.length)]
  applyTheme(pick.id)
  const btn = document.getElementById('shuffle')
  btn.style.transform = 'rotate(360deg)'; setTimeout(() => btn.style.transform = '', 400)
}

function renderSwatches() {
  document.getElementById('swatches').innerHTML =
    PAL.map(p => `<div class="sw${p.id===curPal?' on':''}" data-k="${p.id}" style="background:${p.s}" onclick="applyTheme('${p.id}')"></div>`).join('') +
    `<button id="shuffle" onclick="shuffleTheme()" style="width:24px;height:24px;border-radius:50%;border:1.5px solid var(--b);color:var(--s);font-size:13px;display:flex;align-items:center;justify-content:center;transition:transform .4s ease;margin-left:3px">↻</button>` +
    `<button id="darkbtn" onclick="toggleDark()">${document.body.classList.contains('dark')?ICON_SUN:ICON_MOON}</button>`
}

function genSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPin(pin, salt) {
  if (!pin) return ''
  const enc = new TextEncoder()
  if (!salt) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256' },
    key, 256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const COLORS = [
  '#C4856A','#CA7C4C','#D39858','#BB8588','#B97D7B',
  '#8B1C22','#7F0303','#FF819C','#B37AD4','#8BA3C5',
  '#3EB9A8','#5AA371','#193A31','#575527','#2D4D45',
  '#0E155E','#495B7D','#1A0800',
]
let pendingColor = COLORS[0]
function setPendingColor(c) {
  pendingColor = c
  document.querySelectorAll('.color-pick').forEach(el => el.classList.toggle('active', el.dataset.c === c))
}
function colorPickerHtml(selected) {
  return `<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px">
    ${COLORS.map(c=>`<button type="button" class="color-pick${c===selected?' active':''}" data-c="${c}" style="background:${c}" onclick="setPendingColor('${c}')"></button>`).join('')}
  </div>`
}
function openAddUser() {
  pendingColor = COLORS[db.users.length % COLORS.length]
  document.getElementById('up-colors').innerHTML = colorPickerHtml(pendingColor)
  document.getElementById('un').value = ''; document.getElementById('up').value = ''
  show('ov-user')
  setTimeout(() => document.getElementById('un').focus(), 50)
}

let db = JSON.parse(localStorage.getItem('mt') || '{"users":[],"lib":{}}')
let uid = localStorage.getItem('mt_uid') || null, fid = 'all', pending = null

const save    = () => localStorage.setItem('mt', JSON.stringify(db))
const sync    = () => { save(); remotePut(db) }
const saveUid = () => uid ? localStorage.setItem('mt_uid', uid) : localStorage.removeItem('mt_uid')
const me      = () => db.users.find(u => u.id === uid) || null
const myLib   = () => db.lib[uid] || {folders:[], tracks:[]}
const bigArt  = u => u?.replace('100x100bb','600x600bb') || ''
const spotUrl = t => `https://open.spotify.com/search/${encodeURIComponent(t.trackName+' '+t.artistName)}`
const hide    = id => document.getElementById(id).classList.remove('show')
const show    = id => document.getElementById(id).classList.add('show')
const nameExists = name => db.users.some(u => u.name === name)

function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200)
}

async function initAdmin() {
  const old = db.users.find(u => u.id === 'admin')
  if (old && !old.salt) db.users = db.users.filter(u => u.id !== 'admin')
  if (db.users.some(u => u.id === 'admin')) return
  const salt = genSalt()
  const pin  = await hashPin('jesus1219!!', salt)
  db.users.unshift({id:'admin', name:'관리자', pin, salt, bio:'MixTune 관리자', insta:'', artist:'', song:'', playlist:'', color:'#8B1C22', todayPick:null, isAdmin:true})
  db.lib['admin'] = db.lib['admin'] || {folders:[], tracks:[]}
  sync()
}

let timer = null
const qEl = document.getElementById('q'), res = document.getElementById('results')
qEl.addEventListener('input', () => { clearTimeout(timer); const q=qEl.value.trim(); if(!q){res.style.display='none';return}; timer=setTimeout(()=>search(q),350) })
qEl.addEventListener('blur',  () => setTimeout(() => res.style.display='none', 160))
qEl.addEventListener('focus', () => { if(res.innerHTML) res.style.display='block' })
qEl.addEventListener('keydown', e => e.key==='Escape' && (res.style.display='none'))

async function search(q) {
  const data = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8&country=KR`).then(r=>r.json())
  window._tracks = data.results
  res.innerHTML = data.results.map(t => `
    <div class="ri" onclick="pickTrack(${t.trackId})">
      ${t.artworkUrl100?`<img src="${t.artworkUrl100.replace('100x100bb','60x60bb')}">`:''}<div><div class="rn">${t.trackName}</div><div class="ra">${t.artistName}</div></div>
    </div>`).join('') || `<div style="padding:14px;text-align:center;font-size:13px;color:var(--s)">결과 없음</div>`
  res.style.display = 'block'
}

function pickTrack(id) {
  if (!me()) { toast('로그인 후 추가할 수 있어요'); showLogin(); return }
  pending = window._tracks?.find(t => t.trackId===id); if (!pending) return
  res.style.display = 'none'
  const isOn = me()?.todayPick?.trackId === pending.trackId
  document.getElementById('opt-name').textContent = pending.trackName
  document.getElementById('opt-artist').textContent = pending.artistName
  document.getElementById('opt-actions').innerHTML = `
    <button class="opt-btn" onclick="setTodayPick()"><span>✦</span>${isOn?'추천곡 해제':'오늘의 추천곡으로 설정'}</button>
    <hr style="border:none;border-top:1px solid var(--b);margin:3px 0">
    <button class="opt-btn" onclick="addTo(null)"><span>♪</span>전체에 추가</button>
    ${myLib().folders.map(f=>`<button class="opt-btn" onclick="addTo('${f.id}')"><span>◎</span>${f.name}</button>`).join('')}
    <button class="btn-g" style="margin-top:4px" onclick="hide('ov-track')">취소</button>`
  show('ov-track')
}

function setTodayPick() {
  const i = db.users.findIndex(u => u.id===uid)
  db.users[i].todayPick = db.users[i].todayPick?.trackId===pending.trackId ? null : {...pending, pickedAt:Date.now()}
  sync(); hide('ov-track'); renderPicks(); qEl.value = ''
}

function clearMyPick() {
  const i = db.users.findIndex(u => u.id===uid); if (i < 0) return
  db.users[i].todayPick = null
  sync(); renderPicks()
}


function addTo(folderId) {
  if (!db.lib[uid]) db.lib[uid] = {folders:[], tracks:[]}
  if (!db.lib[uid].tracks.some(t => t.trackId===pending.trackId && t.folderId===folderId)) {
    db.lib[uid].tracks.unshift({...pending, folderId, addedAt:Date.now()}); sync(); renderLib()
  }
  hide('ov-track'); qEl.value = ''
}

function removeTrack(trackId, folderId) {
  db.lib[uid].tracks = db.lib[uid].tracks.filter(t => !(t.trackId===trackId && t.folderId===folderId)); sync(); renderLib()
}

function renderPicks() {
  const picks = db.users.filter(u => u.todayPick)
  document.getElementById('picks').innerHTML = picks.length ? picks.map(u => {
    const t = u.todayPick, img = bigArt(t.artworkUrl100)
    return `<div class="pick-card fade-in">
      ${img?`<img src="${img}">`:''}
      <div class="pi">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="who" onclick="viewProfile('${u.id}')" style="flex:1;text-align:left"><span style="background:${u.color}"></span>${u.name}의 추천</button>
          ${u.id===uid?`<button onclick="clearMyPick()" style="font-size:11px;color:var(--s);opacity:.6;background:none;border:none;cursor:pointer;padding:2px 4px">내리기</button>`:''}
        </div>
        ${u.bio?`<div style="font-size:11px;color:var(--s);margin-top:2px;margin-bottom:6px;opacity:.8;line-height:1.4">${u.bio}</div>`:''}
        <div style="font-size:14px;font-weight:500;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.trackName}</div>
        <div style="font-size:11px;color:var(--s);margin-top:2px">${t.artistName}</div>
        ${t.previewUrl?`<audio controls src="${t.previewUrl}"></audio>`:''}
        <a href="${spotUrl(t)}" target="_blank" style="display:inline-block;margin-top:7px;font-size:11px;border:1px solid var(--b);padding:2px 9px;border-radius:999px;color:var(--s)">Spotify ↗</a>
      </div></div>`}).join('') : `<p class="empty">아직 추천곡이 없어</p>`
}

function renderLib() {
  const u = me(), lib = myLib()
  document.getElementById('lib').style.display = u ? 'block' : 'none'
  if (!u) return
  document.getElementById('lib-title').textContent = `${u.name}의 음악`
  document.getElementById('folders').innerHTML = [{id:'all',name:'전체'}, ...lib.folders].map(f => `
    <button class="ftab${fid===f.id?' on':''}" onclick="setFid('${f.id}')">
      ${f.name}${fid===f.id&&f.id!=='all'?` <span onclick="event.stopPropagation();delFolder('${f.id}')" style="margin-left:3px;opacity:.7">×</span>`:''}
    </button>`).join('')
  const filtered = fid==='all' ? lib.tracks : lib.tracks.filter(t => t.folderId===fid)
  document.getElementById('feed').innerHTML = filtered.length ? filtered.map(t => {
    const art = bigArt(t.artworkUrl100)
    return `<div class="card fade-in">
      <div class="top">
        ${art?`<img src="${art}">`:''}
        <div class="info">
          <div><div class="tn">${t.trackName}</div><div class="an">${t.artistName}</div></div>
          <div class="bot">
            ${t.previewUrl?`<audio controls src="${t.previewUrl}"></audio>`:`<span style="font-size:11px;color:var(--s);opacity:.4">미리듣기 없음</span>`}
            <a href="${spotUrl(t)}" target="_blank">Spotify ↗</a>
            <button class="del" onclick="removeTrack(${t.trackId},'${t.folderId}')">×</button>
          </div>
        </div>
      </div>
    </div>`}).join('') : `<p class="empty">검색해서 곡을 추가해봐</p>`
}

function setFid(id) { fid = id; renderLib() }
function delFolder(id) {
  const lib = db.lib[uid]
  lib.folders = lib.folders.filter(f => f.id!==id)
  lib.tracks  = lib.tracks.filter(t => t.folderId!==id)
  fid = 'all'; sync(); renderLib()
}
let discoverGrid = parseInt(localStorage.getItem('mt_dgrid') || '4')
function setDiscoverGrid(n) {
  discoverGrid = n
  localStorage.setItem('mt_dgrid', n)
  document.getElementById('discover').style.gridTemplateColumns = `repeat(${n},1fr)`
  ;[1,2,4].forEach(v => {
    const btn = document.getElementById(`dg${v}`)
    if (btn) btn.style.background = v===n ? 'var(--a)' : ''
    if (btn) btn.style.color = v===n ? 'var(--at)' : 'var(--s)'
    if (btn) btn.style.borderColor = v===n ? 'var(--a)' : 'var(--b)'
  })
}

function renderDiscover() {
  const tracks = []
  db.users.forEach(u => {
    if (u.libPublic === false || u.isAdmin) return
    const lib = db.lib[u.id] || {tracks:[]}
    lib.tracks.forEach(t => tracks.push({...t, _name:u.name, _color:u.color, _id:u.id}))
  })
  const wrap = document.getElementById('discover-wrap')
  if (!tracks.length) { wrap.style.display='none'; return }
  wrap.style.display = 'block'
  const seen = new Set()
  const unique = tracks.filter(t => { if (seen.has(t.trackId)) return false; seen.add(t.trackId); return true })
  const picked = unique.sort(()=>Math.random()-.5).slice(0,4)
  setDiscoverGrid(window.innerWidth <= 620 ? 1 : discoverGrid)
  document.getElementById('discover').innerHTML = picked.map(t => {
    const img = bigArt(t.artworkUrl100)
    return `<div class="pick-card fade-in">
      ${img?`<img src="${img}">`:''}
      <div class="pi">
        <button class="who" onclick="viewProfile('${t._id}')" style="width:100%;text-align:left"><span style="background:${t._color}"></span>${t._name}의 라이브러리</button>
        <div style="font-size:14px;font-weight:500;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px">${t.trackName}</div>
        <div style="font-size:11px;color:var(--s);margin-top:2px">${t.artistName}</div>
        ${t.previewUrl?`<audio controls src="${t.previewUrl}"></audio>`:''}
        <a href="${spotUrl(t)}" target="_blank" style="display:inline-block;margin-top:7px;font-size:11px;border:1px solid var(--b);padding:2px 9px;border-radius:999px;color:var(--s)">Spotify ↗</a>
      </div></div>`}).join('')
}

const sectionOpen = {
  picks:    localStorage.getItem('mt_s_picks')    !== 'false',
  discover: localStorage.getItem('mt_s_discover') !== 'false',
}
function toggleSection(id) {
  sectionOpen[id] = !sectionOpen[id]
  localStorage.setItem(`mt_s_${id}`, sectionOpen[id])
  applySectionState(id)
}
function applySectionState(id) {
  const open = sectionOpen[id]
  if (id === 'picks') {
    document.getElementById('picks').style.display = open ? '' : 'none'
    const ch = document.getElementById('picks-chevron')
    if (ch) ch.textContent = open ? '∨' : '∧'
  } else {
    document.getElementById('discover').style.display = open ? '' : 'none'
    const ch = document.getElementById('discover-chevron')
    if (ch) ch.textContent = open ? '∨' : '∧'
  }
}

function renderAll() { renderPicks(); renderDiscover(); renderLib(); applySectionState('picks'); applySectionState('discover') }

function renderHeader() {
  const u = me(), el = document.getElementById('hdr-right')
  if (!u) { el.innerHTML = `<button class="login-btn" onclick="showLogin()">로그인</button>`; return }
  const p = `border:1px solid var(--b);padding:3px 11px;border-radius:999px;font-size:12px`
  let html = `<button onclick="location.href='profile.html?id=${u.id}'" style="${p};color:var(--t);display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${u.color};flex-shrink:0;display:inline-block"></span><span style="max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</span></button>`
  html += `<button onclick="location.href='friends.html'" style="${p};color:var(--s)">친구들</button>`
  if (u.isAdmin) html += `<button onclick="location.href='admin.html'" style="${p};color:var(--a);border-color:var(--a)">관리자</button>`
  if (u.isAdmin) html += `<button onclick="openAddUser()" style="${p};color:var(--s)">+ 사용자</button>`
  if (!u.isAdmin) html += `<button onclick="openFeedback()" style="${p};color:var(--s)">후기!</button>`
  html += `<button onclick="doLogout()" style="${p};color:var(--s)">로그아웃</button>`
  el.innerHTML = html
}

function viewProfile(userId) { location.href = `profile.html?id=${userId}` }

function showLogin() {
  const body = document.getElementById('login-body'), title = document.getElementById('login-title')
  show('ov-login')
  title.textContent = '로그인'
  let lid = null
  body.innerHTML = `
    <div id="ulist">${db.users.map(u=>`<button class="usel" onclick="selUser('${u.id}')"><span class="dot" style="background:${u.color}"></span>${u.name}</button>`).join('')}</div>
    <button style="width:100%;padding:8px;border-radius:11px;background:transparent;border:1px dashed var(--bs);font-size:13px;color:var(--s);cursor:pointer;margin-bottom:4px" onclick="showCreate()">+ 새 계정 만들기</button>
    <div id="pin-sec" style="display:none;margin-top:8px">
      <input class="inp" id="lpin" type="password" placeholder="비밀번호" maxlength="20" onkeydown="if(event.key==='Enter')doLogin()"/>
      <button class="btn-p" onclick="doLogin()">로그인</button>
      <button class="btn-g" onclick="showLogin()">뒤로</button>
    </div>
    <div id="create-sec" style="display:none;margin-top:8px">
      <input class="inp" id="cname" type="text" placeholder="이름 또는 아이디" onkeydown="if(event.key==='Enter')document.getElementById('cpin').focus()"/>
      <p style="font-size:12px;color:var(--s);margin-bottom:8px">프로필 색상</p>
      <div id="create-colors"></div>
      <input class="inp" id="cpin" type="password" placeholder="비밀번호" maxlength="20" onkeydown="if(event.key==='Enter')createFromLogin()"/>
      <button class="btn-p" onclick="createFromLogin()">만들기</button>
      <button class="btn-g" onclick="showLogin()">뒤로</button>
    </div>`
  window.selUser = id => { lid=id; document.getElementById('pin-sec').style.display='block'; document.getElementById('lpin').focus() }
  window.showCreate = () => {
    document.getElementById('pin-sec').style.display='none'
    document.getElementById('create-sec').style.display='block'
    document.getElementById('ulist').style.display='none'
    pendingColor = COLORS[db.users.length % COLORS.length]
    document.getElementById('create-colors').innerHTML = colorPickerHtml(pendingColor)
    setTimeout(() => document.getElementById('cname')?.focus(), 50)
  }
  window.doLogin = async () => {
    const u = db.users.find(u => u.id===lid); if (!u) return
    const hashed = await hashPin(document.getElementById('lpin').value, u.salt)
    if (u.pin && hashed!==u.pin) {
      const inp = document.getElementById('lpin'); inp.style.borderColor='var(--a)'; inp.value=''; inp.placeholder='틀렸어'; return
    }
    uid=u.id; saveUid(); hide('ov-login'); fid='all'; renderHeader(); renderAll()
  }
  window.createFromLogin = async () => {
    const name = document.getElementById('cname').value.trim()
    if (!name) return
    if (nameExists(name)) { toast('이미 있는 이름이야'); return }
    const salt = genSalt()
    const pin  = await hashPin(document.getElementById('cpin').value.trim(), salt)
    const u = {id:Date.now()+'', name, pin, salt, bio:'', insta:'', artist:'', song:'', playlist:'', color:pendingColor, todayPick:null}
    db.users.push(u); db.lib[u.id]={folders:[],tracks:[]}; sync()
    uid=u.id; saveUid(); hide('ov-login'); fid='all'; renderHeader(); renderAll()
  }
}

async function addUser() {
  const name = document.getElementById('un').value.trim()
  if (!name) return
  if (nameExists(name)) { toast('이미 있는 이름이야'); return }
  const salt = genSalt()
  const pin  = await hashPin(document.getElementById('up').value.trim(), salt)
  const u = {id:Date.now()+'', name, pin, salt, bio:'', insta:'', artist:'', song:'', playlist:'', color:pendingColor, todayPick:null}
  db.users.push(u); db.lib[u.id]={folders:[],tracks:[]}; sync()
  document.getElementById('un').value=''; document.getElementById('up').value=''; hide('ov-user'); renderPicks()
}

function doLogout() { uid=null; saveUid(); renderHeader(); renderAll() }

let pendingRating = 0
function setRating(n) {
  pendingRating = n
  document.querySelectorAll('.star-btn').forEach(b => {
    b.style.opacity = parseInt(b.dataset.v) <= n ? '1' : '.3'
    b.style.color = parseInt(b.dataset.v) <= n ? 'var(--a)' : ''
  })
}

function openFeedback() {
  pendingRating = 0
  document.getElementById('fb-text').value = ''
  document.querySelectorAll('.star-btn').forEach(b => { b.style.opacity='.3'; b.style.color='' })
  show('ov-feedback')
}

function submitFeedback() {
  const text = document.getElementById('fb-text').value.trim()
  if (!pendingRating && !text) { toast('별점이나 내용을 입력해줘'); return }
  if (!db.feedback) db.feedback = []
  db.feedback.push({ id:Date.now()+'', userId:uid, userName:me()?.name||'익명', rating:pendingRating, text, createdAt:Date.now(), read:false })
  sync(); hide('ov-feedback'); toast('보냈어 👍')
}

function openFolder() { show('ov-folder'); document.getElementById('fn').value=''; setTimeout(()=>document.getElementById('fn').focus(),50) }
function mkFolder() {
  const name = document.getElementById('fn').value.trim(); if (!name||!uid) return
  if (!db.lib[uid]) db.lib[uid] = {folders:[], tracks:[]}
  db.lib[uid].folders.push({id:Date.now()+'', name}); sync(); hide('ov-folder'); renderLib()
}
document.getElementById('fn').addEventListener('keydown', e => e.key==='Enter' && mkFolder())

async function pullRemote() {
  const r = await remoteGet()
  if (!r) return
  const before = r.users?.length || 0
  db = mergeDb(db, r, uid)

  if (before < db.users.length) sync(); else save()
  renderAll(); renderHeader()
}

;(async () => {
  const remote = await remoteGet()
  if (remote) {
    const before = remote.users?.length || 0
    db = mergeDb(db, remote, uid)
    if (before < db.users.length) sync(); else save()
  }

  await initAdmin()
  if (uid && !db.users.find(u => u.id===uid)) { uid=null; saveUid() }
  applyTheme(curPal)
  renderSwatches()
  renderHeader()
  renderAll()
  setInterval(() => { if (!document.hidden) pullRemote() }, 15000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullRemote() })
})()
