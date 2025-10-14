import React, { useState, useEffect } from 'react';

const RealtimeStatus = ({ isConnected, lastUpdate, changeType }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [statusColor, setStatusColor] = useState('green');

  // Show notification only when changes are made
  useEffect(() => {
    if (lastUpdate && changeType) {
      setIsVisible(true);
      
      // Hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [lastUpdate, changeType]);

  useEffect(() => {
    if (!isConnected) {
      setStatusColor('red');
    } else {
      setStatusColor('green');
    }
  }, [isConnected]);

  // Don't render if not visible
  if (!isVisible) return null;

  const getChangeMessage = () => {
    switch (changeType) {
      case 'add':
        return '✅ Report added successfully!';
      case 'update':
        return '📝 Report updated successfully!';
      case 'delete':
        return '🗑️ Report deleted successfully!';
      case 'status':
        return '📊 Status updated successfully!';
      default:
        return '🔄 Changes synced!';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'rgba(255, 255, 255, 0.98)',
      padding: '8px 12px',
      borderRadius: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      fontSize: '12px',
      zIndex: 999,
      border: `1.5px solid ${statusColor}`,
      animation: 'slideInRight 0.3s ease-out',
      maxWidth: '220px',
      minWidth: '180px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          animation: 'pulse 1.5s infinite',
        }} />
        <div style={{ fontWeight: '500', color: '#333' }}>
          {getChangeMessage()}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default RealtimeStatus;