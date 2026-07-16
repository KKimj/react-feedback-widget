import React from 'react';
import { FeedbackProvider } from 'react-visual-feedback';

function App() {
  return (
    <FeedbackProvider
      onSubmit={async (data) => {
        console.log('=== Feedback Submitted ===', data);
        try {
          const r = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data),
          });
          console.log('e2e result:', await r.json());
        } catch (e) {
          console.error('e2e submit failed:', e);
        }
      }}
      dashboard={true}
      userName="Test User"
      userEmail="test@test.com"
      userAvatar="https://i.pravatar.cc/150?u=test@test.com"
      mode="light"
    >
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Feedback Dots Test</h1>
        <p style={{ color: '#666', marginBottom: 40 }}>
          <strong>Alt+Q</strong> = select element &amp; submit feedback &nbsp;|&nbsp;
          <strong>Alt+D</strong> = toggle dots
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <Card title="Card One" color="#3b82f6">
            This is the first card. Click anywhere on it to leave feedback.
          </Card>
          <Card title="Card Two" color="#10b981">
            This is the second card. Try clicking the title vs the body.
          </Card>
          <Card title="Card Three" color="#8b5cf6">
            This is the third card. Each dot remembers the exact click position.
          </Card>
        </div>

        <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
          <button
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Primary Button
          </button>
          <button
            style={{
              padding: '12px 24px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Danger Button
          </button>
          <button
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Success Button
          </button>
        </div>
      </div>
    </FeedbackProvider>
  );
}

function Card({ title, color, children }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderTop: `3px solid ${color}`,
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>{title}</h3>
      <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{children}</p>
    </div>
  );
}

Card.displayName = 'Card';

export default App;
