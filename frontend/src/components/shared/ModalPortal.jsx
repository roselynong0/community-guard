import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

/**
 * ModalPortal - Renders children into a portal at document body level
 * This ensures modals escape any CSS containment, overflow, or stacking context
 * issues from parent containers like .main-area
 * 
 * Usage:
 * <ModalPortal>
 *   <div className="modal-overlay">
 *     <div className="modal">...</div>
 *   </div>
 * </ModalPortal>
 */
function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState(null);

  useEffect(() => {
    // Create or find the portal container
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
      // Don't remove the container on unmount - other modals might use it
      // Just let it stay empty
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
