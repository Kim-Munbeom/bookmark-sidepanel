const treeRootEl = document.getElementById('tree-root');
const searchInputEl = document.getElementById('search-input');
const addCurrentTabBtn = document.getElementById('add-current-tab-btn');
const statusMessageEl = document.getElementById('status-message');

function showStatusMessage(message) {
  statusMessageEl.textContent = message;
  statusMessageEl.classList.remove('hidden');
}

showStatusMessage('사이드패널 스캐폴드 준비 완료');
