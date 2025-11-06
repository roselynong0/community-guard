import React from 'react';

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorCount: 0,
      lastError: null 
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Admin Error Boundary caught an error:', error, errorInfo);
    
    // Increment error count
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1,
      lastError: error.message
    }));

    // If too many errors, force logout
    if (this.state.errorCount >= 3) {
      this.forceLogout();
    }
  }

  forceLogout = () => {
    console.warn('Force logout triggered due to repeated errors');
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>
              🚨 Admin Panel Error
            </h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Something went wrong in the admin panel. This might be due to an infinite loop or system error.
            </p>
            
            {this.state.errorCount >= 2 && (
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '5px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <strong>⚠️ Multiple errors detected ({this.state.errorCount})</strong>
                <br />
                Consider using Force Logout to clear all data.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔄 Try Again
              </button>
              
              <button
                onClick={this.forceLogout}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🚨 Force Logout
              </button>
            </div>

            {this.state.lastError && (
              <details style={{ marginTop: '20px', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: '#666' }}>
                  Technical Details
                </summary>
                <pre style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  borderRadius: '5px',
                  fontSize: '12px',
                  overflow: 'auto'
                }}>
                  {this.state.lastError}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;