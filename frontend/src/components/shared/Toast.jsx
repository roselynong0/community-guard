import React, { useState, useCallback } from 'react';
import './Toast.css';
import { FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaTimes, FaBell } from 'react-icons/fa';

const Toast = React.forwardRef(({ autoCloseDuration = 4000 }, ref) => {
  const [toasts, setToasts] = useState([]);

  const getIcon = useCallback((type) => {
    switch (type) {
      case 'success':
      case 'approved':
        return <FaCheckCircle className="toast-icon" />;
      case 'error':
        return <FaTimesCircle className="toast-icon" />;
      case 'warning':
        return <FaExclamationTriangle className="toast-icon" />;
      case 'emergency':
        return <FaBell className="toast-icon" />;
      case 'info':
      case 'deleted':
      default:
        return <FaInfoCircle className="toast-icon" />;
    }
  }, []);

  const show = useCallback((message, type = 'info') => {
    const id = Date.now();
    const newToast = { id, message, type };
    
    setToasts(prev => [...prev, newToast]);

    const duration = type === 'emergency' ? 8000 : autoCloseDuration;

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);

    return id;
  }, [autoCloseDuration]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  React.useImperativeHandle(ref, () => ({
    show,
    remove,
  }));

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            {getIcon(toast.type)}
            <span className="toast-message">{toast.message}</span>
          </div>
          <button 
            className="toast-close" 
            onClick={() => remove(toast.id)}
            aria-label="Close notification"
          >
            <FaTimes />
          </button>
        </div>
      ))}
    </div>
  );
});

Toast.displayName = 'Toast';

export default Toast;