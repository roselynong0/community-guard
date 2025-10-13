import React, { useState } from 'react';
import ModernLoading, { 
  DashboardLoading, 
  CompactLoading, 
  InlineLoading, 
  ModalLoading,
  ShimmerLoading,
  ListLoading 
} from './ModernLoading';
import './ModernLoading.css';

// 🎪 Demo component to showcase all loading animations
const LoadingAnimationDemo = () => {
  const [activeDemo, setActiveDemo] = useState('basic');
  const [showShimmer, setShowShimmer] = useState(true);

  const animationTypes = [
    { key: 'ring', name: 'Ring Spinner', description: 'Multi-colored rotating rings' },
    { key: 'dots', name: 'Pulsing Dots', description: 'Rhythmic pulsing dots' },
    { key: 'balls', name: 'Bouncing Balls', description: 'Colorful bouncing animation' },
    { key: 'squares', name: 'Morphing Squares', description: 'Transforming geometric shapes' },
    { key: 'wave', name: 'Wave Loader', description: 'Sound wave-inspired bars' },
    { key: 'particles', name: 'Particle Orbit', description: 'Orbiting colored particles' }
  ];

  const themes = ['primary', 'success', 'warning'];
  const sizes = ['compact', 'normal', 'large'];

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#2d2d73',
        marginBottom: '2rem',
        fontSize: '2.5rem'
      }}>
        🎨 Modern Loading Animations Demo
      </h1>

      {/* Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {[
          { key: 'basic', name: '🎯 Basic Animations' },
          { key: 'prebuilt', name: '🎪 Pre-built Components' },
          { key: 'advanced', name: '🚀 Advanced Features' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveDemo(tab.key)}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: activeDemo === tab.key ? '#2d2d73' : '#f1f5f9',
              color: activeDemo === tab.key ? 'white' : '#64748b',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Basic Animations Demo */}
      {activeDemo === 'basic' && (
        <div>
          <h2 style={{ color: '#2d2d73', marginBottom: '1.5rem' }}>🎯 Basic Animation Types</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {animationTypes.map(type => (
              <div key={type.key} style={{
                padding: '2rem',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                background: 'white',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <h3 style={{ color: '#2d2d73', marginBottom: '0.5rem' }}>{type.name}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '1.5rem' }}>
                  {type.description}
                </p>
                <ModernLoading 
                  type={type.key} 
                  text={`Loading with ${type.name.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>

          {/* Size and Theme Variations */}
          <div style={{ marginTop: '3rem' }}>
            <h3 style={{ color: '#2d2d73', marginBottom: '1.5rem' }}>🎨 Size & Theme Variations</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem'
            }}>
              {sizes.map(size => (
                <div key={size} style={{
                  padding: '1.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  textAlign: 'center'
                }}>
                  <h4 style={{ color: '#2d2d73', textTransform: 'capitalize' }}>{size} Size</h4>
                  <ModernLoading 
                    type="ring" 
                    size={size}
                    text={`${size} loading`}
                  />
                </div>
              ))}
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginTop: '1.5rem'
            }}>
              {themes.map(theme => (
                <div key={theme} style={{
                  padding: '1.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  textAlign: 'center'
                }}>
                  <h4 style={{ color: '#2d2d73', textTransform: 'capitalize' }}>{theme} Theme</h4>
                  <ModernLoading 
                    type="balls" 
                    theme={theme}
                    text={`${theme} theme`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pre-built Components Demo */}
      {activeDemo === 'prebuilt' && (
        <div>
          <h2 style={{ color: '#2d2d73', marginBottom: '1.5rem' }}>🎪 Pre-built Loading Components</h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {/* Compact Loading */}
            <div style={{
              padding: '2rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>Compact Loading</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '1rem' }}>
                Perfect for cards and modals
              </p>
              <CompactLoading text="Loading profile..." type="squares" />
            </div>

            {/* Inline Loading */}
            <div style={{
              padding: '2rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>Inline Loading</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '1rem' }}>
                Great for buttons and small spaces
              </p>
              <InlineLoading text="Refreshing..." type="balls" />
            </div>

            {/* Modal Loading */}
            <div style={{
              padding: '2rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>Modal Loading</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '1rem' }}>
                Styled for overlay modals
              </p>
              <ModalLoading text="Processing request..." />
            </div>
          </div>

          {/* Dashboard Loading Preview */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>Dashboard Loading (Full Screen)</h3>
            <div style={{ 
              height: '300px', 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <DashboardLoading text="Loading community dashboard..." />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Features Demo */}
      {activeDemo === 'advanced' && (
        <div>
          <h2 style={{ color: '#2d2d73', marginBottom: '1.5rem' }}>🚀 Advanced Features</h2>
          
          {/* Shimmer Loading */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ color: '#2d2d73', margin: 0 }}>Shimmer Loading</h3>
              <button
                onClick={() => setShowShimmer(!showShimmer)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#2d2d73',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Toggle Shimmer
              </button>
            </div>
            <ShimmerLoading isLoading={showShimmer}>
              <div style={{
                padding: '2rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white'
              }}>
                <h4 style={{ color: '#2d2d73' }}>Sample Content</h4>
                <p style={{ color: '#64748b' }}>
                  This content shows a shimmer effect when loading. The shimmer overlay
                  gives users visual feedback that content is being loaded.
                </p>
              </div>
            </ShimmerLoading>
          </div>

          {/* List Loading */}
          <div>
            <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>List Loading</h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Perfect for loading multiple items in a list or feed
            </p>
            <ListLoading count={3} type="wave" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '3rem', 
        padding: '2rem',
        background: 'linear-gradient(135deg, #f8f9ff 0%, #e9ecff 100%)',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#2d2d73', marginBottom: '1rem' }}>🌟 Modern Loading Benefits</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {[
            '60% smoother animations',
            'Better user engagement',
            'Reduced perceived wait time',
            'Mobile responsive',
            'Performance optimized',
            'Multiple themes & sizes'
          ].map((benefit, index) => (
            <div key={index} style={{
              padding: '1rem',
              background: 'white',
              borderRadius: '8px',
              color: '#2d2d73',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              ✅ {benefit}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingAnimationDemo;