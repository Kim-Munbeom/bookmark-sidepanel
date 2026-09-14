# Bookmark Sidepanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome Side Panel API를 사용해, 북마크를 네이티브 세로 탭처럼 왼쪽(사용자가 Chrome 설정에서 지정)에 조회/검색/편집할 수 있는 Manifest V3 확장 프로그램을 만든다.

**Architecture:** 빌드 도구 없는 바닐라 HTML/CSS/JS. `background.js`(서비스 워커)는 설치 시 패널 동작만 설정하고, 모든 로직은 `sidepanel/sidepanel.js`(SPA 형태로 side panel이 열려있는 동안 유지)에 있다. `chrome.bookmarks` API로 트리를 읽고 쓰며, `chrome.bookmarks.on*` 이벤트로 외부 변경사항도 실시간 반영한다.

**Tech Stack:** Vanilla JS (ES2020+, async/await), Manifest V3, `chrome.bookmarks`, `chrome.sidePanel`, `chrome.tabs`.

**Spec:** `docs/specs/2026-09-14-bookmark-sidepanel-design.md`

## Global Constraints

- 권한은 `bookmarks`, `sidePanel`, `tabs`만 사용한다. (스펙 작성 시 `tabs` 없이 가능하다고 가정했으나, 계획 단계에서 확인한 결과 "현재 탭 URL 조회"는 `tabs` 권한 없이는 신뢰성 있게 동작하지 않아 추가함 — activeTab만으로는 side panel이 열린 뒤 다른 탭으로 전환 시 URL 접근이 보장되지 않음. 이 정정 외 스펙의 최소 권한 원칙은 유지.)
- 빌드 도구/프레임워크 도입 금지 — 순수 HTML/CSS/JS만 사용한다.
- v1 범위 제외: 커스터마이징 설정 화면, 폴더 펼침 상태의 영구 저장, 별도 작업 로그 파일.
- 테스트 인프라가 없으므로 **모든 검증은 수동 검증**(압축해제된 확장 프로그램 로드 후 실제 클릭/드래그로 확인)이다. 각 태스크의 "수동 검증" 스텝을 건너뛰지 않는다.
- 프로젝트 구조는 스펙에 정의된 대로 고정한다 (`manifest.json`, `background.js`, `sidepanel/`, `icons/`, `docs/`).

---

### Task 1: 프로젝트 스캐폴드 (manifest, 아이콘, background, 빈 side panel)

**Files:**
- Create: `manifest.json`
- Create: `background.js`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- Create: `sidepanel/sidepanel.html`
- Create: `sidepanel/sidepanel.css`
- Create: `sidepanel/sidepanel.js`

**Interfaces:**
- Produces: side panel이 툴바 아이콘 클릭으로 열리는 빈 셸 (다음 태스크들이 `sidepanel.js`에 로직을 채워넣음).

- [ ] **Step 1: 플레이스홀더 아이콘 생성**

macOS `sips`로 1x1 PNG를 128/48/16 크기로 스케일업한다 (실제 디자인은 나중에 교체 가능한 임시 아이콘).

```bash
mkdir -p icons
python3 -c "
import base64
data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
open('icons/icon128.png', 'wb').write(data)
"
sips -z 128 128 icons/icon128.png --out icons/icon128.png
sips -z 48 48 icons/icon128.png --out icons/icon48.png
sips -z 16 16 icons/icon128.png --out icons/icon16.png
```

- [ ] **Step 2: 결과 확인**

Run: `file icons/*.png`
Expected: 세 파일 모두 `PNG image data`로 표시되고 각각 16x16/48x48/128x128 크기.

- [ ] **Step 3: `manifest.json` 작성**

```json
{
  "manifest_version": 3,
  "name": "Bookmark Sidepanel",
  "version": "0.1.0",
  "description": "북마크를 사이드패널에서 조회, 검색, 편집합니다.",
  "permissions": ["bookmarks", "sidePanel", "tabs"],
  "action": {
    "default_title": "북마크 사이드패널 열기/닫기",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 4: `background.js` 작성**

```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('side panel behavior 설정 실패:', error));
});
```

- [ ] **Step 5: `sidepanel/sidepanel.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>북마크 사이드패널</title>
  <link rel="stylesheet" href="sidepanel.css" />
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <input id="search-input" type="text" placeholder="북마크 검색..." />
      <button id="add-current-tab-btn" title="현재 탭을 북마크에 추가">+ 현재 탭</button>
    </div>
    <div id="status-message" class="hidden"></div>
    <div id="tree-root"></div>
  </div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 6: `sidepanel/sidepanel.css` 작성**

```css
:root {
  color-scheme: light dark;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  font-size: 13px;
}

#toolbar {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

#search-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
}

#status-message {
  padding: 12px 8px;
  opacity: 0.7;
}

#status-message.hidden {
  display: none;
}

.folder-header {
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.folder-header:hover,
.bookmark-row:hover {
  background: rgba(128, 128, 128, 0.15);
}

.folder-header.drag-over {
  outline: 2px dashed rgba(66, 133, 244, 0.8);
  outline-offset: -2px;
}

.folder-children {
  padding-left: 14px;
}

.bookmark-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  gap: 6px;
}

.bookmark-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.delete-btn {
  flex-shrink: 0;
  font-size: 11px;
}
```

- [ ] **Step 7: `sidepanel/sidepanel.js` 작성 (빈 셸)**

```javascript
const treeRootEl = document.getElementById('tree-root');
const searchInputEl = document.getElementById('search-input');
const addCurrentTabBtn = document.getElementById('add-current-tab-btn');
const statusMessageEl = document.getElementById('status-message');

function showStatusMessage(message) {
  statusMessageEl.textContent = message;
  statusMessageEl.classList.remove('hidden');
}

showStatusMessage('사이드패널 스캐폴드 준비 완료');
```

- [ ] **Step 8: 수동 검증**

1. Chrome에서 `chrome://extensions` 접속, 우측 상단 "개발자 모드" 켜기
2. "압축해제된 확장 프로그램을 로드합니다" 클릭 → 이 프로젝트 루트 폴더 선택
3. 툴바에 확장 프로그램 아이콘이 보이는지 확인
4. 아이콘 클릭 → 사이드패널이 열리고 "사이드패널 스캐폴드 준비 완료" 텍스트와 검색창, "+ 현재 탭" 버튼이 보이는지 확인
5. 사이드패널 안에서 우클릭 → "검사" → 콘솔에 에러가 없는지 확인

Expected: 에러 없이 셸 UI가 정상적으로 표시됨.

- [ ] **Step 9: 커밋**

```bash
git add manifest.json background.js icons sidepanel
git commit -m "feat: 확장 프로그램 스캐폴드 및 빈 side panel 셸 추가"
```

---

### Task 2: 북마크 트리 렌더링 (읽기 전용, 펼침/접힘, 빈 상태)

**Files:**
- Modify: `sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: Task 1의 `treeRootEl`, `statusMessageEl`, `showStatusMessage`.
- Produces: `loadTree()`, `renderTree()`, `isFolder(node)` — 이후 태스크에서 재사용.

- [ ] **Step 1: `sidepanel.js` 전체를 다음 내용으로 교체**

```javascript
const treeRootEl = document.getElementById('tree-root');
const searchInputEl = document.getElementById('search-input');
const addCurrentTabBtn = document.getElementById('add-current-tab-btn');
const statusMessageEl = document.getElementById('status-message');

const expandedFolderIds = new Set(['1']); // '1' = 북마크바, 기본으로 펼침
let currentTree = [];

function isFolder(node) {
  return node.url === undefined;
}

function showStatusMessage(message) {
  statusMessageEl.textContent = message;
  statusMessageEl.classList.remove('hidden');
}

function clearStatusMessage() {
  statusMessageEl.textContent = '';
  statusMessageEl.classList.add('hidden');
}

async function loadTree() {
  const [rootNode] = await chrome.bookmarks.getTree();
  currentTree = rootNode.children ?? [];
  renderTree();
}

function renderTree() {
  treeRootEl.innerHTML = '';

  if (currentTree.length === 0) {
    showStatusMessage('북마크가 없습니다.');
    return;
  }

  clearStatusMessage();
  for (const topFolder of currentTree) {
    treeRootEl.appendChild(renderFolder(topFolder));
  }
}

function renderFolder(folderNode) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder';
  wrapper.dataset.id = folderNode.id;

  const header = document.createElement('div');
  header.className = 'folder-header';
  header.textContent = `${expandedFolderIds.has(folderNode.id) ? '▾' : '▸'} ${folderNode.title || '(제목 없음)'}`;
  header.addEventListener('click', () => toggleFolder(folderNode.id));
  wrapper.appendChild(header);

  if (!expandedFolderIds.has(folderNode.id)) {
    return wrapper;
  }

  const childrenEl = document.createElement('div');
  childrenEl.className = 'folder-children';
  for (const child of folderNode.children ?? []) {
    childrenEl.appendChild(isFolder(child) ? renderFolder(child) : renderBookmarkRow(child));
  }
  wrapper.appendChild(childrenEl);
  return wrapper;
}

function renderBookmarkRow(bookmarkNode) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.dataset.id = bookmarkNode.id;

  const titleEl = document.createElement('span');
  titleEl.className = 'bookmark-title';
  titleEl.textContent = bookmarkNode.title || bookmarkNode.url;
  titleEl.title = bookmarkNode.url;
  row.appendChild(titleEl);

  return row;
}

function toggleFolder(folderId) {
  if (expandedFolderIds.has(folderId)) {
    expandedFolderIds.delete(folderId);
  } else {
    expandedFolderIds.add(folderId);
  }
  renderTree();
}

loadTree();
```

- [ ] **Step 2: 수동 검증**

1. `chrome://extensions`에서 이 확장 프로그램의 새로고침 버튼 클릭
2. 사이드패널을 닫았다가 다시 열기
3. 실제 Chrome 북마크(북마크바, 기타 북마크 등)와 트리 구조가 일치하는지 `chrome://bookmarks`와 비교하며 확인
4. 폴더 제목 클릭 시 펼침(▾)/접힘(▸) 토글되는지 확인
5. (임시로) 모든 북마크를 백업 후 삭제해 빈 상태를 만들면 "북마크가 없습니다." 문구가 보이는지 확인 — 확인 후 백업에서 복원

Expected: 트리 구조가 정확히 일치하고, 토글이 정상 동작하며, 빈 상태 문구가 표시됨.

- [ ] **Step 3: 커밋**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: 북마크 트리 읽기 전용 렌더링 추가"
```

---

### Task 3: 북마크 클릭 시 새 탭에서 열기

**Files:**
- Modify: `sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: Task 2의 `renderBookmarkRow(bookmarkNode)`.
- Produces: 클릭 시 `chrome.tabs.create` 호출 (다른 태스크는 이 동작에 의존하지 않음).

- [ ] **Step 1: `renderBookmarkRow` 함수를 다음으로 교체**

```javascript
function renderBookmarkRow(bookmarkNode) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.dataset.id = bookmarkNode.id;

  const titleEl = document.createElement('span');
  titleEl.className = 'bookmark-title';
  titleEl.textContent = bookmarkNode.title || bookmarkNode.url;
  titleEl.title = bookmarkNode.url;
  titleEl.addEventListener('click', () => chrome.tabs.create({ url: bookmarkNode.url }));
  row.appendChild(titleEl);

  return row;
}
```

- [ ] **Step 2: 수동 검증**

1. 확장 프로그램 새로고침 후 사이드패널 열기
2. 아무 북마크나 클릭
3. 해당 URL로 새 탭이 열리는지 확인

Expected: 클릭한 북마크의 정확한 URL로 새 탭이 열림.

- [ ] **Step 3: 커밋**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: 북마크 클릭 시 새 탭에서 열기"
```

---

### Task 4: 검색/필터링

**Files:**
- Modify: `sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: `currentTree`, `isFolder`, `renderBookmarkRow`, `showStatusMessage`, `clearStatusMessage`, `treeRootEl`, `searchInputEl`.
- Produces: `renderTree()`가 검색어 유무에 따라 분기 (Task 7의 실시간 동기화가 이 `renderTree()`를 재사용).

- [ ] **Step 1: `renderTree` 함수를 다음으로 교체하고, 그 아래에 `renderSearchResults`, `collectMatchingBookmarks` 추가**

```javascript
function renderTree() {
  treeRootEl.innerHTML = '';

  const query = searchInputEl.value.trim().toLowerCase();
  if (query) {
    renderSearchResults(query);
    return;
  }

  if (currentTree.length === 0) {
    showStatusMessage('북마크가 없습니다.');
    return;
  }

  clearStatusMessage();
  for (const topFolder of currentTree) {
    treeRootEl.appendChild(renderFolder(topFolder));
  }
}

function renderSearchResults(query) {
  const matches = [];
  collectMatchingBookmarks(currentTree, query, matches);

  if (matches.length === 0) {
    showStatusMessage('검색 결과가 없습니다.');
    return;
  }

  clearStatusMessage();
  const list = document.createElement('div');
  list.className = 'search-results';
  for (const bookmark of matches) {
    list.appendChild(renderBookmarkRow(bookmark));
  }
  treeRootEl.appendChild(list);
}

function collectMatchingBookmarks(nodes, query, results) {
  for (const node of nodes) {
    if (isFolder(node)) {
      collectMatchingBookmarks(node.children ?? [], query, results);
      continue;
    }
    const haystack = `${node.title} ${node.url}`.toLowerCase();
    if (haystack.includes(query)) {
      results.push(node);
    }
  }
}
```

- [ ] **Step 2: 파일 맨 아래(`loadTree();` 호출 바로 위)에 검색창 이벤트 리스너 추가**

```javascript
searchInputEl.addEventListener('input', renderTree);
```

- [ ] **Step 3: 수동 검증**

1. 확장 프로그램 새로고침 후 사이드패널 열기
2. 실제 존재하는 북마크 제목의 일부를 검색창에 입력 → 해당 북마크만 평평한 리스트로 표시되는지 확인
3. URL 일부로도 검색해서 매칭되는지 확인
4. 존재하지 않는 문자열 입력 → "검색 결과가 없습니다." 표시 확인
5. 검색창을 비우면 원래 트리 구조로 돌아오는지 확인

Expected: 위 4가지 모두 정상 동작.

- [ ] **Step 4: 커밋**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: 북마크 검색/필터링 추가"
```

---

### Task 5: 북마크 추가(현재 탭) & 삭제

**Files:**
- Modify: `sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: `renderBookmarkRow`, `renderFolder`, `showStatusMessage`, `isFolder`, `addCurrentTabBtn`.
- Produces: `addCurrentTabAsBookmark()`, `deleteNode(node)` — Task 6의 드래그앤드롭과 Task 7의 동기화가 동일한 삭제/추가 흐름과 공존.

- [ ] **Step 1: `renderBookmarkRow`에 삭제 버튼 추가 (함수 전체 교체)**

```javascript
function renderBookmarkRow(bookmarkNode) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.dataset.id = bookmarkNode.id;

  const titleEl = document.createElement('span');
  titleEl.className = 'bookmark-title';
  titleEl.textContent = bookmarkNode.title || bookmarkNode.url;
  titleEl.title = bookmarkNode.url;
  titleEl.addEventListener('click', () => chrome.tabs.create({ url: bookmarkNode.url }));
  row.appendChild(titleEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteNode(bookmarkNode);
  });
  row.appendChild(deleteBtn);

  return row;
}
```

- [ ] **Step 2: `renderFolder`의 header에도 삭제 버튼을 추가하기 위해 함수 전체 교체**

```javascript
function renderFolder(folderNode) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder';
  wrapper.dataset.id = folderNode.id;

  const header = document.createElement('div');
  header.className = 'folder-header';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = `${expandedFolderIds.has(folderNode.id) ? '▾' : '▸'} ${folderNode.title || '(제목 없음)'}`;
  titleSpan.addEventListener('click', () => toggleFolder(folderNode.id));
  header.appendChild(titleSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteNode(folderNode);
  });
  header.appendChild(deleteBtn);

  wrapper.appendChild(header);

  if (!expandedFolderIds.has(folderNode.id)) {
    return wrapper;
  }

  const childrenEl = document.createElement('div');
  childrenEl.className = 'folder-children';
  for (const child of folderNode.children ?? []) {
    childrenEl.appendChild(isFolder(child) ? renderFolder(child) : renderBookmarkRow(child));
  }
  wrapper.appendChild(childrenEl);
  return wrapper;
}
```

- [ ] **Step 3: `sidepanel.css`의 `.folder-header` 규칙을 다음으로 교체 (버튼이 추가되어 flex 레이아웃 필요)**

```css
.folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  cursor: pointer;
  gap: 6px;
}

.folder-header span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 4: 파일 끝(`searchInputEl.addEventListener(...)` 아래, `loadTree();` 위)에 추가/삭제 함수와 버튼 리스너 추가**

```javascript
async function deleteNode(node) {
  try {
    if (isFolder(node)) {
      await chrome.bookmarks.removeTree(node.id);
    } else {
      await chrome.bookmarks.remove(node.id);
    }
  } catch (error) {
    showStatusMessage(`삭제 실패: ${error.message}`);
  }
}

async function addCurrentTabAsBookmark() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url) {
      showStatusMessage('현재 탭 정보를 가져올 수 없습니다.');
      return;
    }
    await chrome.bookmarks.create({
      parentId: '1',
      title: activeTab.title || activeTab.url,
      url: activeTab.url,
    });
  } catch (error) {
    showStatusMessage(`추가 실패: ${error.message}`);
  }
}

addCurrentTabBtn.addEventListener('click', addCurrentTabAsBookmark);
```

- [ ] **Step 5: 수동 검증**

1. 확장 프로그램 새로고침 후 사이드패널 열기
2. 아무 웹사이트나 열고 사이드패널의 "+ 현재 탭" 클릭 → `chrome://bookmarks`의 북마크바 최상단(또는 끝)에 추가됐는지 확인, 사이드패널 트리에도 반영되는지 확인 (Task 7 전이므로 수동 새로고침 없이는 반영 안 될 수 있음 — 이 경우 패널을 닫았다 열어서 확인)
3. 북마크 항목의 "삭제" 클릭 → `chrome://bookmarks`에서도 사라졌는지 확인
4. 자식이 있는 폴더의 "삭제" 클릭 → 폴더와 그 안의 모든 북마크가 함께 삭제되는지 확인 (테스트용 임시 폴더로 진행할 것)

Expected: 추가/삭제 모두 실제 Chrome 북마크에 정확히 반영됨.

- [ ] **Step 6: 커밋**

```bash
git add sidepanel/sidepanel.js sidepanel/sidepanel.css
git commit -m "feat: 북마크 추가(현재 탭)/삭제 기능 추가"
```

---

### Task 6: 드래그앤드롭 이동

**Files:**
- Modify: `sidepanel/sidepanel.js`
- Modify: `sidepanel/sidepanel.css`

**Interfaces:**
- Consumes: `renderFolder`, `renderBookmarkRow`, `isFolder`, `showStatusMessage`.
- Produces: `attachDragHandlers(el, node)`, `moveNode(draggedId, targetNode)`.

- [ ] **Step 1: `renderFolder`의 header 생성 부분에 `header.draggable = true;`와 `attachDragHandlers(header, folderNode);` 추가, `renderBookmarkRow`의 row 생성 부분에 `row.draggable = true;`와 `attachDragHandlers(row, bookmarkNode);` 추가**

`renderFolder` 함수를 다음으로 전체 교체:

```javascript
function renderFolder(folderNode) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder';
  wrapper.dataset.id = folderNode.id;

  const header = document.createElement('div');
  header.className = 'folder-header';
  header.draggable = true;

  const titleSpan = document.createElement('span');
  titleSpan.textContent = `${expandedFolderIds.has(folderNode.id) ? '▾' : '▸'} ${folderNode.title || '(제목 없음)'}`;
  titleSpan.addEventListener('click', () => toggleFolder(folderNode.id));
  header.appendChild(titleSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteNode(folderNode);
  });
  header.appendChild(deleteBtn);

  attachDragHandlers(header, folderNode);
  wrapper.appendChild(header);

  if (!expandedFolderIds.has(folderNode.id)) {
    return wrapper;
  }

  const childrenEl = document.createElement('div');
  childrenEl.className = 'folder-children';
  for (const child of folderNode.children ?? []) {
    childrenEl.appendChild(isFolder(child) ? renderFolder(child) : renderBookmarkRow(child));
  }
  wrapper.appendChild(childrenEl);
  return wrapper;
}
```

`renderBookmarkRow` 함수를 다음으로 전체 교체:

```javascript
function renderBookmarkRow(bookmarkNode) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.dataset.id = bookmarkNode.id;
  row.draggable = true;

  const titleEl = document.createElement('span');
  titleEl.className = 'bookmark-title';
  titleEl.textContent = bookmarkNode.title || bookmarkNode.url;
  titleEl.title = bookmarkNode.url;
  titleEl.addEventListener('click', () => chrome.tabs.create({ url: bookmarkNode.url }));
  row.appendChild(titleEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteNode(bookmarkNode);
  });
  row.appendChild(deleteBtn);

  attachDragHandlers(row, bookmarkNode);
  return row;
}
```

- [ ] **Step 2: 파일 끝(`addCurrentTabBtn.addEventListener(...)` 아래, `loadTree();` 위)에 드래그 핸들러와 이동 함수 추가**

```javascript
function attachDragHandlers(el, node) {
  el.addEventListener('dragstart', (event) => {
    event.stopPropagation();
    event.dataTransfer.setData('text/plain', node.id);
  });

  el.addEventListener('dragover', (event) => {
    event.preventDefault();
    el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over');
  });

  el.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.classList.remove('drag-over');
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === node.id) return;
    await moveNode(draggedId, node);
  });
}

async function moveNode(draggedId, targetNode) {
  try {
    if (isFolder(targetNode)) {
      await chrome.bookmarks.move(draggedId, { parentId: targetNode.id });
      return;
    }
    const [targetInfo] = await chrome.bookmarks.get(targetNode.id);
    await chrome.bookmarks.move(draggedId, {
      parentId: targetInfo.parentId,
      index: targetInfo.index,
    });
  } catch (error) {
    showStatusMessage(`이동 실패: ${error.message}`);
  }
}
```

- [ ] **Step 3: `sidepanel.css` 끝에 북마크 행의 드래그오버 표시 스타일 추가**

`.folder-header.drag-over` 규칙은 Task 1에서 이미 추가됨. 북마크 행 위로 드래그했을 때도 동일하게 표시되도록 다음을 파일 끝에 추가한다.

```css
.bookmark-row.drag-over {
  outline: 2px dashed rgba(66, 133, 244, 0.8);
  outline-offset: -2px;
}
```

- [ ] **Step 4: 수동 검증**

1. 확장 프로그램 새로고침 후 사이드패널 열기
2. 북마크 하나를 다른 폴더 위로 드래그해서 드롭 → 드롭 대상 폴더 헤더에 점선 테두리가 보이는지(드래그오버 표시), 드롭 후 `chrome://bookmarks`에서 실제로 이동했는지 확인
3. 같은 폴더 안의 다른 북마크 위로 드래그해서 드롭 → 드래그하는 동안 대상 북마크 행에 점선 테두리가 보이는지, 드롭 후 그 북마크 바로 앞으로 순서가 바뀌는지 확인
4. 폴더를 다른 폴더 위로 드래그 → 하위 폴더로 이동하는지 확인

Expected: 세 가지 이동 시나리오 모두 `chrome://bookmarks`에 정확히 반영되고, 드래그 중 대상 요소(폴더/북마크 모두)에 점선 테두리가 표시됨.

- [ ] **Step 5: 커밋**

```bash
git add sidepanel/sidepanel.js sidepanel/sidepanel.css
git commit -m "feat: 드래그앤드롭으로 북마크/폴더 이동 추가"
```

---

### Task 7: 외부 변경 실시간 동기화

**Files:**
- Modify: `sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: `loadTree`.
- Produces: 없음 (마지막 배선 작업).

- [ ] **Step 1: 파일 끝, `loadTree();` 호출 바로 위에 리스너 등록 함수 추가하고 호출**

```javascript
function registerBookmarkChangeListeners() {
  chrome.bookmarks.onCreated.addListener(loadTree);
  chrome.bookmarks.onRemoved.addListener(loadTree);
  chrome.bookmarks.onChanged.addListener(loadTree);
  chrome.bookmarks.onMoved.addListener(loadTree);
  chrome.bookmarks.onChildrenReordered.addListener(loadTree);
}

registerBookmarkChangeListeners();
```

- [ ] **Step 2: 수동 검증**

1. 확장 프로그램 새로고침 후 사이드패널 열기 (닫지 않고 유지)
2. 사이드패널을 통하지 않고 `chrome://bookmarks` 페이지에서 직접 북마크를 추가/삭제/이름 변경
3. 사이드패널을 새로고침하지 않아도 트리가 자동으로 갱신되는지 확인
4. Task 5에서 "+ 현재 탭"으로 추가했을 때도 이제는 패널을 닫았다 열지 않아도 즉시 반영되는지 재확인

Expected: 외부에서 바뀐 북마크가 패널에 자동으로 반영됨.

- [ ] **Step 3: 커밋**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat: 북마크 변경 이벤트에 따른 실시간 동기화 추가"
```

---

### Task 8: README 작성 + 전체 엔드투엔드 수동 검증

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 전체 기능.
- Produces: 없음 (최종 검증 태스크).

- [ ] **Step 1: `README.md` 작성**

```markdown
# Bookmark Sidepanel

Chrome Side Panel API로 북마크를 조회/검색/편집하는 확장 프로그램입니다.
네이티브 세로 탭과 유사한 사용성을 목표로 하며, 상세 설계는
`docs/specs/2026-09-14-bookmark-sidepanel-design.md`를 참고하세요.

## 설치 (개발자 모드)

1. `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" 켜기
3. "압축해제된 확장 프로그램을 로드합니다" → 이 폴더 선택
4. 툴바 아이콘 클릭으로 사이드패널 열기/닫기

## 사이드패널을 왼쪽으로 이동

Chrome 설정 → 모양 → 사이드패널 → 왼쪽으로 변경 (확장 프로그램이 아닌 Chrome 자체 설정입니다).

## 알려진 제약

- 브라우저를 재시작하면 사이드패널이 자동으로 열리지 않습니다. 툴바 아이콘을 한 번 클릭해야 합니다. (Chrome 플랫폼 제약, 우회 불가)
- 사이드패널 최소 폭은 약 320px이며 이 아래로 줄일 수 없습니다.
- 폭을 조절해도 브라우저 재시작 시 기본값(약 360px)으로 초기화됩니다.
- 아이콘은 임시 플레이스홀더입니다 (`icons/`). 배포 전 교체가 필요합니다.

## 아직 지원하지 않는 기능 (v1 범위 밖)

- UI 커스터마이징 설정 화면 (색상, 폰트 크기 등)
- 폴더 펼침 상태의 영구 저장
```

- [ ] **Step 2: 전체 엔드투엔드 수동 검증**

1. `chrome://extensions`에서 확장 프로그램 새로고침
2. Chrome 설정에서 사이드패널을 왼쪽으로 이동
3. 툴바 아이콘 클릭 → 왼쪽에 패널이 열리고, 웹페이지 콘텐츠 폭이 실제로 줄어드는지(오버레이가 아닌지) 확인
4. 패널 안쪽 경계를 드래그해 폭을 조절 → 320px 아래로는 줄어들지 않는지, 그 이상은 자유롭게 늘어나는지 확인
5. 트리 조회, 검색, 추가, 삭제, 드래그앤드롭 이동을 각각 한 번씩 실행해 전부 정상 동작하는지 확인
6. Chrome을 완전히 재시작 → 패널이 자동으로 열리지 않는 것(예상된 동작), 아이콘 클릭 시 다시 열리는 것, 폭이 기본값으로 초기화된 것을 확인

Expected: 6개 항목 모두 스펙 문서에 기술된 대로 동작.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: README 및 알려진 제약사항 정리"
```
