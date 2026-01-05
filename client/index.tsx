import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider } from './components/ToastProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);

// PWA Service Worker Registration - IMPROVED FOR STORE DETECTION
if ('serviceWorker' in navigator) {
  // We register immediately (no 'load' event wait) to satisfy PWABuilder scanners
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('SW registered: ', registration);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New content available; auto-reloading...');
              window.location.reload();
            } else {
              console.log('Content is cached for offline use.');
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('SW registration failed: ', error);
    });
}
