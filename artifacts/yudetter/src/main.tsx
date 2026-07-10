// アセットのダイナミックインポート失敗（デプロイ更新によるアセット名変更）を検知して自動で強制リロードを行う
window.addEventListener('error', (e) => {
  const message = e.message || '';
  const isScriptError = e.target && (e.target as HTMLElement).tagName === 'SCRIPT';
  const isAsset = isScriptError && ((e.target as HTMLScriptElement).src || '').includes('/assets/');
  
  if (
    message.includes('dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    isAsset
  ) {
    console.warn('Asset loading failed (likely due to new deployment). Reloading page to fetch latest version...', e);
    window.location.reload();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const message = reason?.message || '';
  if (
    reason instanceof TypeError && (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed')
    )
  ) {
    console.warn('Unhandled dynamic import error detected. Reloading page...', e);
    window.location.reload();
  }
});

import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
