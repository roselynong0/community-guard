import React from 'react';
import Home from './Home';

// ResponderHome simply reuses the main Home dashboard but can be extended
// to show responder-specific widgets in the future. We pass session/token
// through as-is so Home can fetch the correct stats.
export default function ResponderHome(props) {
  return <Home {...props} />;
}
