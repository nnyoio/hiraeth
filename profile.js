const PAL = [
  {id:'t1',s:'#C4856A'},{id:'t2',s:'#8B1C22'},{id:'t3',s:'#FF819C'},
  {id:'t4',s:'#9EC0EB'},{id:'t5',s:'#BB8588'},{id:'t6',s:'#8BA3C5'},
  {id:'t7',s:'#CA7C4C'},{id:'t8',s:'#B37AD4'},{id:'t9',s:'#D39858'},
  {id:'t10',s:'#7F0303'},{id:'t11',s:'#575527'},{id:'t12',s:'#5AA371'},
]
const COLORS = [
  '#C4856A','#CA7C4C','#D39858','#BB8588','#B97D7B',
  '#8B1C22','#7F0303','#FF819C','#B37AD4','#8BA3C5',
  '#3EB9A8','#5AA371','#193A31','#575527','#2D4D45',
  '#0E155E','#495B7D','#1A0800',
]
const PAL_MIGRATE = {film:'t1',academia:'t2',candy:'t3',hydrangea:'t4',peony:'t5',arctic:'t6',vintage:'t7',ocean:'t8',amber:'t9',nautical:'t10',matcha:'t11',jungle:'t12'}
let curPal = localStorage.getItem('mt_pal') || 't1'
if (PAL_MIGRATE[curPal]) { curPal = PAL_MIGRATE[curPal]; localStorage.setItem('mt_pal', curPal) }
function applyTheme(id) {
  document.body.classList.forEach(c => { if (c.startsWith('p-')) document.body.classList.remove(c) })
  document.body.classList.add(`p-${id}`)
  curPal = id; localStorage.setItem('mt_pal', id)
  document.querySelectorAll('.sw').forEach(e => e.classList.toggle('on', e.dataset.k === id))
  document.getElementById('hdr').style.background = ''
}
function shuffleTheme() {
  applyTheme(PAL[Math.floor(Math.random() * PAL.length)].id)
  const btn = document.getElementById('shuffle')
  if (btn) { btn.style.transform='rotate(360deg)'; setTimeout(()=>btn.style.transform='',400) }
}
function renderSwatches() {
  document.getElementById('swatches').innerHTML =
    PAL.map(p=>`<div class="sw${p.id===curPal?' on':''}" data-k="${p.id}" style="background:${p.s}" onclick="applyTheme('${p.id}')"></div>`).join('') +
    `<button id="shuffle" onclick="shuffleTheme()" style="width:24px;height:24px;border-radius:50%;border:1.5px solid var(--b);color:var(--s);font-size:13px;display:flex;align-items:center;justify-content:center;transition:transform .4s ease;margin-left:3px">↻</button>` +
    `<button id="darkbtn" onclick="toggleDark()">${document.body.classList.contains('dark')?ICON_SUN:ICON_MOON}</button>`
}

function genSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('')
}
async function hashPin(pin, salt) {
  if (!pin) return ''
  const enc = new TextEncoder()
  if (!salt) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin))
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
  }
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256)
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

let db   = JSON.parse(localStorage.getItem('mt') || '{"users":[],"lib":{}}')
const save = () => localStorage.setItem('mt', JSON.stringify(db))
const sync = () => { save(); remotePut(db) }
const uid  = localStorage.getItem('mt_uid')
const me   = () => db.users.find(u => u.id === uid) || null
const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

function toast(msg) {
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg
  document.body.appendChild(el); setTimeout(()=>el.remove(),2200)
}

let targetId, target
let isEditing = false
let pendingColor = COLORS[0]
let pendingLibPublic = true
let _artistResults = [], _songResults = []
let artistTimer = null, songTimer = null

// ── 헤더 ──────────────────────────────────────────────
function renderHeader() {
  const u = me()
  document.getElementById('hdr-right').innerHTML = u
    ? `<span style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--t)">
         <span style="width:8px;height:8px;border-radius:50%;background:${u.color};display:inline-block"></span>${esc(u.name)}</span>
       <button onclick="doLogout()">로그아웃</button>`
    : `<a href="index.html" class="login-btn" style="border:1px solid var(--bs);padding:4px 12px;border-radius:999px;color:var(--a);font-size:12px;text-decoration:none">로그인</a>`
}
function doLogout() { localStorage.removeItem('mt_uid'); location.href='index.html' }

// ── 색상 선택 ──────────────────────────────────────────
function selectColor(c) {
  pendingColor = c
  document.querySelectorAll('.color-pick').forEach(el => el.classList.toggle('active', el.dataset.c === c))
  const av = document.getElementById('p-av')
  if (av) av.style.background = c
}

function colorPickerHtml(selected) {
  return COLORS.map(c =>
    `<button type="button" class="color-pick${c===selected?' active':''}" data-c="${c}" style="background:${c}" onclick="selectColor('${c}')"></button>`
  ).join('')
}

// ── 페이지 렌더 ───────────────────────────────────────
function renderPage() {
  const u = target
  const isMine  = targetId === uid
  const isAdmin = me()?.isAdmin && !u.isAdmin
  const lib = db.lib[targetId] || {folders:[],tracks:[]}
  const safeUrl     = u.playlist && /^https?:\/\//.test(u.playlist) ? u.playlist : null
  const instaHandle = u.insta ? (u.insta.startsWith('@') ? u.insta : '@'+u.insta) : null
  const instaUrl    = instaHandle ? `https://instagram.com/${encodeURIComponent(instaHandle.slice(1))}` : null

  document.getElementById('page').innerHTML = `
    <div class="p-hero" id="p-hero-section">
      <div class="p-avatar" id="p-av" style="background:${isEditing ? pendingColor : u.color}">${esc(u.name[0])}</div>
      <div class="p-name">${esc(u.name)}</div>
      ${u.isAdmin ? `<span class="p-badge">관리자</span>` : ''}
      ${isEditing ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:16px;max-width:240px;margin-left:auto;margin-right:auto">
        ${colorPickerHtml(pendingColor)}
      </div>` : ''}
    </div>

    <div class="p-stats">
      <div class="p-stat"><b>${lib.tracks.length}</b>트랙</div>
      <div class="p-stat"><b>${lib.folders.length}</b>폴더</div>
      <div class="p-stat"><b>${u.todayPick ? '✦' : '—'}</b>오늘의 추천</div>
    </div>

    ${isEditing ? editForm(u) : viewMode(u, isMine, isAdmin, safeUrl, instaHandle, instaUrl, lib)}
  `
}

function viewMode(u, isMine, isAdmin, safeUrl, instaHandle, instaUrl, lib) {
  const artistArt = u.artistArt && (u.artistArt.startsWith('data:') || u.artistArt.startsWith('http')) ? u.artistArt : null
  const songArt   = u.songArt   && u.songArt.startsWith('http') ? u.songArt : null
  const hasLinks  = instaHandle || u.artist || u.song || safeUrl

  return `
    <div class="p-card">
      ${u.bio
        ? `<p class="p-bio">${esc(u.bio)}</p>${hasLinks?'<div class="p-divider"></div>':''}`
        : (!hasLinks ? `<p class="p-empty">아직 아무것도 없어</p>` : '')}
      ${instaHandle ? `<div class="p-row">📸 <a href="${instaUrl}" target="_blank">${esc(instaHandle)}</a></div>` : ''}
      ${u.artist ? `<div class="p-row">
        ${artistArt
          ? `<img src="${artistArt}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : '<span>🎤</span>'}
        <div>
          <div style="font-size:13px;color:var(--t)">${esc(u.artist)}</div>
          <div style="font-size:11px;color:var(--s);opacity:.6">아티스트</div>
        </div>
      </div>` : ''}
      ${u.song ? `<div class="p-row">
        ${songArt
          ? `<img src="${songArt.replace('100x100bb','60x60bb')}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0">`
          : '<span>🎵</span>'}
        <div>
          <div style="font-size:13px;color:var(--t)">${esc(u.song)}</div>
          ${u.songArtist ? `<div style="font-size:11px;color:var(--s);opacity:.6">${esc(u.songArtist)}</div>` : ''}
        </div>
      </div>` : ''}
      ${safeUrl ? `<a href="${safeUrl}" target="_blank" class="plink">▶ 플리 보기</a>` : ''}
    </div>
    ${(isMine || u.libPublic !== false) && lib.tracks.length > 0 ? `
    <div class="p-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:13px;font-weight:500;color:var(--t)">라이브러리</span>
        ${isMine && u.libPublic===false ? `<span style="font-size:11px;color:var(--s);opacity:.55">🔒 나만 보임</span>` : ''}
      </div>
      ${lib.tracks.slice(0,30).map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--b)">
          ${t.artworkUrl100 ? `<img src="${t.artworkUrl100.replace('100x100bb','60x60bb')}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">` : ''}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.trackName)}</div>
            <div style="font-size:11px;color:var(--s)">${esc(t.artistName)}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}
    <div class="p-actions">
      ${isMine || isAdmin ? `<button class="btn-p" onclick="startEdit()">수정하기</button>` : ''}
      ${isAdmin ? `<button class="btn-g" style="border-color:rgba(196,133,106,.4);color:var(--a)" onclick="deleteUser()">계정 삭제</button>` : ''}
    </div>`
}

function editForm(u) {
  const isCustomArtist = u.artistArt && u.artistArt.startsWith('data:')
  const customPreview  = isCustomArtist && u.artistArt
    ? `<img src="${esc(u.artistArt)}" style="width:100%;height:100%;object-fit:cover">`
    : '<span style="font-size:20px">📷</span>'

  return `
    <div class="p-card">
      <textarea class="inp" id="p-bio" placeholder="자기소개 (80자 이내)" maxlength="80" rows="3" style="resize:none">${esc(u.bio||'')}</textarea>

      <!-- 아티스트 검색 -->
      <div style="position:relative;margin-bottom:6px">
        <input class="inp" id="p-artist-q" type="text" placeholder="아티스트 검색 (iTunes)..."
          value="${isCustomArtist ? '' : esc(u.artist||'')}"
          oninput="searchArtist()" onfocus="if(this.value.trim())searchArtist()"
          onblur="setTimeout(()=>{const r=document.getElementById('p-artist-res');if(r)r.style.display='none'},180)"
          style="margin-bottom:0"/>
        <div id="p-artist-res" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg);border:1px solid var(--bs);border-radius:12px;overflow-y:auto;max-height:220px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:50"></div>
      </div>
      <input type="hidden" id="p-artist-art" value="${isCustomArtist ? esc(u.artistArt||'') : esc(u.artistArt||'')}"/>

      <div id="custom-artist" style="display:${isCustomArtist?'block':'none'};padding:12px;background:var(--warm);border-radius:12px;margin-bottom:6px">
        <p style="font-size:11px;color:var(--s);margin-bottom:8px">직접 입력</p>
        <div style="display:flex;align-items:center;gap:10px">
          <div id="custom-art-preview" onclick="document.getElementById('custom-art-file').click()"
            style="width:44px;height:44px;border-radius:8px;flex-shrink:0;overflow:hidden;cursor:pointer;background:var(--b);display:flex;align-items:center;justify-content:center">
            ${customPreview}
          </div>
          <input class="inp" id="custom-artist-name" type="text" placeholder="아티스트 이름"
            value="${isCustomArtist ? esc(u.artist||'') : ''}" style="margin:0;flex:1"/>
        </div>
        <input type="file" id="custom-art-file" accept="image/*" style="display:none" onchange="handleCustomArtPhoto(this)"/>
        <button type="button" style="font-size:11px;color:var(--s);margin-top:8px;background:none;border:none;cursor:pointer"
          onclick="hideCustomArtist()">← iTunes 검색으로</button>
      </div>

      <!-- 노래 검색 -->
      <div style="position:relative;margin-bottom:6px">
        <input class="inp" id="p-song-q" type="text" placeholder="노래 검색 (iTunes)..."
          value="${esc(u.song||'')}"
          oninput="searchSong()" onfocus="if(this.value.trim())searchSong()"
          onblur="setTimeout(()=>{const r=document.getElementById('p-song-res');if(r)r.style.display='none'},180)"
          style="margin-bottom:0"/>
        <div id="p-song-res" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg);border:1px solid var(--bs);border-radius:12px;overflow-y:auto;max-height:220px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:50"></div>
      </div>
      <input type="hidden" id="p-song-art"    value="${esc(u.songArt||'')}"/>
      <input type="hidden" id="p-song-artist" value="${esc(u.songArtist||'')}"/>

      <input class="inp" id="p-insta"    type="text" placeholder="인스타 아이디 (예: @username)" value="${esc(u.insta||'')}"/>
      <input class="inp" id="p-playlist" type="url"  placeholder="유튜브 / 스포티파이 플리 링크"  value="${esc(u.playlist||'')}"/>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--b);margin-top:4px">
        <span style="font-size:13px;color:var(--t)">라이브러리 공개</span>
        <button type="button" id="lib-pub-btn" onclick="toggleLibPublic()"
          style="font-size:12px;padding:4px 14px;border-radius:999px;border:1px solid var(--bs);color:${pendingLibPublic?'var(--a)':'var(--s)'}">
          ${pendingLibPublic ? '공개' : '비공개'}
        </button>
      </div>
    </div>
    <div class="p-actions">
      <button class="btn-p" onclick="saveProfile()">저장</button>
      <button class="btn-g" onclick="cancelEdit()">취소</button>
    </div>`
}

// ── 아티스트 검색 ────────────────────────────────────────
function searchArtist() {
  clearTimeout(artistTimer)
  const q = document.getElementById('p-artist-q')?.value.trim()
  const res = document.getElementById('p-artist-res'); if (!res) return
  if (!q) { res.style.display='none'; return }
  artistTimer = setTimeout(async () => {
    const data = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&attribute=artistTerm&limit=15&country=KR`).then(r=>r.json()).catch(()=>({results:[]}))
    const seen = new Set()
    _artistResults = data.results.filter(t => { if (seen.has(t.artistId)) return false; seen.add(t.artistId); return true }).slice(0,5)
    res.innerHTML = _artistResults.map((t,i)=>`
      <div class="ri" onmousedown="selectArtist(${i})">
        <img src="${t.artworkUrl100?.replace('100x100bb','60x60bb')||''}" style="border-radius:50%;width:36px;height:36px;object-fit:cover;flex-shrink:0">
        <div><div class="rn">${esc(t.artistName)}</div><div class="ra">${esc(t.primaryGenreName||'')}</div></div>
      </div>`).join('')+
      `<div class="ri" onmousedown="showCustomArtist()" style="justify-content:center;color:var(--s);font-size:13px">✎ 직접 입력</div>`
    res.style.display = _artistResults.length || true ? 'block' : 'none'
  }, 350)
}

function selectArtist(i) {
  const t = _artistResults[i]; if (!t) return
  document.getElementById('p-artist-q').value   = t.artistName
  document.getElementById('p-artist-art').value = t.artworkUrl100 || ''
  document.getElementById('p-artist-res').style.display = 'none'
  document.getElementById('custom-artist').style.display = 'none'
}

function showCustomArtist() {
  document.getElementById('p-artist-res').style.display = 'none'
  document.getElementById('custom-artist').style.display = 'block'
  document.getElementById('p-artist-q').value = ''
  document.getElementById('p-artist-art').value = ''
  setTimeout(() => document.getElementById('custom-artist-name')?.focus(), 50)
}

function hideCustomArtist() {
  document.getElementById('custom-artist').style.display = 'none'
  document.getElementById('p-artist-q').focus()
}

async function handleCustomArtPhoto(input) {
  const file = input.files[0]; if (!file) return
  const data = await compressImage(file, 120)
  document.getElementById('p-artist-art').value = data
  document.getElementById('custom-art-preview').innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover">`
}

function compressImage(file, size=120) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const dim = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width-dim)/2, (img.height-dim)/2, dim, dim, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.75))
    }
    img.src = url
  })
}

// ── 노래 검색 ─────────────────────────────────────────
function searchSong() {
  clearTimeout(songTimer)
  const q = document.getElementById('p-song-q')?.value.trim()
  const res = document.getElementById('p-song-res'); if (!res) return
  if (!q) { res.style.display='none'; return }
  songTimer = setTimeout(async () => {
    const data = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8&country=KR`).then(r=>r.json()).catch(()=>({results:[]}))
    _songResults = data.results
    res.innerHTML = _songResults.map((t,i)=>`
      <div class="ri" onmousedown="selectSong(${i})">
        ${t.artworkUrl100?`<img src="${t.artworkUrl100.replace('100x100bb','60x60bb')}" style="border-radius:7px;width:36px;height:36px;object-fit:cover;flex-shrink:0">`:''}
        <div><div class="rn">${esc(t.trackName)}</div><div class="ra">${esc(t.artistName)}</div></div>
      </div>`).join('') || `<div style="padding:14px;text-align:center;font-size:13px;color:var(--s)">결과 없음</div>`
    res.style.display = 'block'
  }, 350)
}

function selectSong(i) {
  const t = _songResults[i]; if (!t) return
  document.getElementById('p-song-q').value      = t.trackName
  document.getElementById('p-song-art').value    = t.artworkUrl100 || ''
  document.getElementById('p-song-artist').value = t.artistName || ''
  document.getElementById('p-song-res').style.display = 'none'
}

// ── 저장 / 삭제 ──────────────────────────────────────
function toggleLibPublic() {
  pendingLibPublic = !pendingLibPublic
  const btn = document.getElementById('lib-pub-btn')
  if (btn) { btn.textContent = pendingLibPublic ? '공개' : '비공개'; btn.style.color = pendingLibPublic ? 'var(--a)' : 'var(--s)' }
}

function startEdit()  { pendingColor = target.color; pendingLibPublic = target.libPublic !== false; isEditing = true; renderPage() }
function cancelEdit() { isEditing = false; renderPage() }

function saveProfile() {
  const i = db.users.findIndex(u => u.id === targetId); if (i < 0) return
  const customVisible = document.getElementById('custom-artist')?.style.display !== 'none'
  const artistName = customVisible
    ? document.getElementById('custom-artist-name').value.trim()
    : document.getElementById('p-artist-q').value.trim()

  db.users[i].color      = pendingColor
  db.users[i].bio        = document.getElementById('p-bio').value.trim()
  db.users[i].artist     = artistName
  db.users[i].artistArt  = document.getElementById('p-artist-art').value
  db.users[i].song       = document.getElementById('p-song-q').value.trim()
  db.users[i].songArt    = document.getElementById('p-song-art').value
  db.users[i].songArtist = document.getElementById('p-song-artist').value
  db.users[i].insta      = document.getElementById('p-insta').value.trim()
  db.users[i].playlist   = document.getElementById('p-playlist').value.trim()
  db.users[i].libPublic  = pendingLibPublic
  Object.assign(target, db.users[i])
  sync(); isEditing = false; renderPage(); toast('저장됐어')
}

function deleteUser() {
  if (!me()?.isAdmin || target.isAdmin) return
  if (!confirm(`"${target.name}" 계정을 삭제할까요?`)) return
  db.users = db.users.filter(u => u.id !== targetId)
  delete db.lib[targetId]; sync(); location.href = 'index.html'
}

;(async () => {
  document.getElementById('page').innerHTML = `<p style="text-align:center;color:var(--s);padding:40px 0;font-size:13px">불러오는 중...</p>`
  const params = new URLSearchParams(location.search)
  targetId = params.get('id') || uid
  if (!targetId) { location.href = 'index.html'; return }

  const remote = await remoteGet()
  if (remote) { db = mergeDb(db, remote, uid); save() }

  target = db.users.find(u => u.id === targetId)
  if (!target) {
    document.getElementById('page').innerHTML = `<p style="text-align:center;color:var(--s);padding:40px 0;font-size:13px">유저를 찾을 수 없어</p>`
    applyTheme(curPal); renderSwatches(); renderHeader(); return
  }
  pendingColor = target.color || COLORS[0]
  applyTheme(curPal)
  renderSwatches()
  renderHeader()
  try { renderPage() } catch(e) {
    document.getElementById('page').innerHTML = `<p style="text-align:center;color:var(--s);padding:40px 0;font-size:13px">오류가 발생했어</p>`
  }
})()
