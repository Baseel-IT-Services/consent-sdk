import { useState } from 'react';
import { BaseelConsent } from '@baseel/consent-react';

function App() {
  const [log, setLog] = useState<string[]>([]);
  const [mounted, setMounted] = useState(true);

  const pushLog = (msg: string) => {
    console.log(msg);
    setLog((prev) => [...prev, msg]);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Baseel Consent React Compat Test</h1>
      <button id="toggle-mount" onClick={() => setMounted((m) => !m)}>
        {mounted ? 'Unmount' : 'Mount'} BaseelConsent
      </button>
      <div id="event-log" style={{ marginTop: 16, border: '1px solid #ccc', padding: 8 }}>
        <strong>Event log:</strong>
        <ul>
          {log.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
      </div>
      {mounted && (
        <BaseelConsent
          publicKey="pk_test"
          screenId="scr_test"
          sessionToken="tok_test"
          apiBaseUrl="http://localhost:4788"
          onConsentGranted={(detail) => pushLog(`onConsentGranted: ${JSON.stringify(detail)}`)}
          onConsentDenied={(detail) => pushLog(`onConsentDenied: ${JSON.stringify(detail)}`)}
          onConsentError={(message) => pushLog(`onConsentError: ${message}`)}
        />
      )}
    </div>
  );
}

export default App;
