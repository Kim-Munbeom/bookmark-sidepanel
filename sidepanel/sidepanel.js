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
  titleEl.addEventListener('click', () => chrome.tabs.create({ url: bookmarkNode.url }));
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

searchInputEl.addEventListener('input', renderTree);
loadTree();
