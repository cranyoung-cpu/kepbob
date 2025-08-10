const app = document.getElementById('app');
const leftBar = document.getElementById('sidebar-left');
const rightBar = document.getElementById('sidebar-right');
const modeToggle = document.getElementById('modeToggle');
const accentPicker = document.getElementById('accentPicker');

modeToggle.addEventListener('change', () => {
  document.documentElement.setAttribute('data-theme', modeToggle.checked ? 'dark' : 'light');
});

accentPicker.addEventListener('input', e => {
  document.documentElement.style.setProperty('--accent', e.target.value);
});

function loadSidebars(page) {
  return fetch(`/api/sidebars/${page}`).then(r => r.json()).then(data => {
    leftBar.innerHTML = data.left.join('');
    rightBar.innerHTML = data.right.join('');
    if (page === 'write') setupWriteFeatures();
  });
}

function route() {
  const hash = location.hash.slice(1) || 'view/main';
  const [page, name] = hash.split('/');
  loadSidebars(page);
  if (page === 'view') viewPage(name);
  if (page === 'write') writePage(name);
  if (page === 'form') formPage();
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

function viewPage(name) {
  fetch(`/api/docs/${name}`).then(r => {
    if (!r.ok) return '<p>문서를 찾을 수 없습니다.</p>';
    return r.text();
  }).then(html => {
    app.innerHTML = html;
  });
}

function writePage(name) {
  app.innerHTML = `
    <div id="editor" class="editor-area" contenteditable="false"></div>
    <div><button id="saveDocBtn">저장</button></div>
  `;
  document.getElementById('saveDocBtn').addEventListener('click', () => saveDoc(name));
}

function setupWriteFeatures() {
  fetch('/api/templates').then(r => r.json()).then(list => {
    const listDiv = document.getElementById('templateList');
    listDiv.innerHTML = list.map(t => `<button data-id="${t.id}">${t.name}</button>`).join('');
    listDiv.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const tpl = list.find(t => t.id === id);
      if (tpl) insertTemplate(tpl);
    });
  });
  setupWriteToolbar();
}

function setupWriteToolbar() {
  const bar = document.getElementById('toolbar');
  if (!bar) return;
  bar.innerHTML = `
    <button data-cmd="bold">굵게</button>
    <button data-cmd="italic">기울임</button>
    <button data-cmd="underline">밑줄</button>
    <button data-cmd="strikeThrough">취소선</button>
    <input type="color" id="fontColorPicker" />
    <button id="linkBtn">링크</button>
  `;
  bar.addEventListener('click', e => {
    const cmd = e.target.getAttribute('data-cmd');
    if (cmd) document.execCommand(cmd, false, null);
  });
  const colorPicker = document.getElementById('fontColorPicker');
  colorPicker.addEventListener('input', e => {
    document.execCommand('foreColor', false, e.target.value);
  });
  document.getElementById('linkBtn').addEventListener('click', () => {
    const url = prompt('링크 주소:');
    if (url) document.execCommand('createLink', false, url);
  });
}

function insertTemplate(tpl) {
  const editor = document.getElementById('editor');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = tpl.html;
  const block = wrapper.firstElementChild;
  editor.appendChild(block);
  const sections = block.querySelector('.sections');
  const addBtn = block.querySelector('.add-root');
  if (addBtn && sections) {
    addBtn.addEventListener('click', () => addSection(sections, 1));
  }
  const imgInput = block.querySelector('.img-input');
  if (imgInput) {
    imgInput.addEventListener('change', handleImageUpload);
  }
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result.split(',')[1];
    fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, data })
    }).then(r => r.json()).then(res => {
      const img = e.target.parentElement.querySelector('.img-preview');
      img.src = res.path;
    });
  };
  reader.readAsDataURL(file);
}

function addSection(parent, depth) {
  const idx = parent.querySelectorAll(`:scope > .section[data-depth="${depth}"]`).length;
  const label = marker(depth, idx);
  const div = document.createElement('div');
  div.className = 'section';
  div.dataset.depth = depth;
  div.innerHTML = `
    <div class="section-header"><span class="marker">${label}</span><div class="title" contenteditable="true"></div></div>
    <div class="content" contenteditable="true"></div>
    <button class="add-sub">항목추가</button>
  `;
  div.querySelector('.add-sub').addEventListener('click', () => addSection(div, depth + 1));
  parent.appendChild(div);
}

function marker(depth, index) {
  const kor = ['가','나','다','라','마','바','사','아','자','차','카','타','파','하'];
  const d = (depth - 1) % 6;
  switch (d) {
    case 0: return `${index + 1}.`;
    case 1: return `${kor[index] || String.fromCharCode('가'.charCodeAt(0) + index)}.`;
    case 2: return `${index + 1})`;
    case 3: return `${kor[index] || String.fromCharCode('가'.charCodeAt(0) + index)})`;
    case 4: return `(${index + 1})`;
    case 5: return `(${kor[index] || String.fromCharCode('가'.charCodeAt(0) + index)})`;
    default: return `${index + 1}.`;
  }
}

function saveDoc(name) {
  const editor = document.getElementById('editor');
  if (!editor.querySelector('.template-block')) {
    alert('최소 하나의 템플릿을 추가해야 합니다.');
    return;
  }
  const content = editor.innerHTML;
  fetch('/api/docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content })
  }).then(r => r.json()).then(r => alert(`저장 완료: ${r.name}`));
}

function formPage() {
  app.innerHTML = `
    <form id="templateForm">
      <label>아이디 <input name="id" required /></label>
      <label>이름 <input name="name" required /></label>
      <label>HTML <textarea name="html" required></textarea></label>
      <button type="submit">저장</button>
    </form>
  `;
  document.getElementById('templateForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => (data[k] = v));
    fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(() => alert('템플릿 저장 완료'));
  });
}
