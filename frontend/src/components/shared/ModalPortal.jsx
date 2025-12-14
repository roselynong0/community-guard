import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState(null);

  useEffect(() => {
    let container = document.getElementById('modal-portal-root');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-portal-root';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
      `;
      document.body.appendChild(container);
    }
    
    setPortalRoot(container);
    setMounted(true);

    return () => {
    };
  }, []);

  if (!mounted || !portalRoot) {
    return null;
  }

  return createPortal(
    <div style={{ pointerEvents: 'auto' }}>
      {children}
    </div>,
    portalRoot
  );
}

export default ModalPortal;