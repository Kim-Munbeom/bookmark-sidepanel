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

function toggleFolder(folderId) {
  if (expandedFolderIds.has(folderId)) {
    expandedFolderIds.delete(folderId);
  } else {
    expandedFolderIds.add(folderId);
  }
  renderTree();
}

searchInputEl.addEventListener('input', renderTree);

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

loadTree();
