import React from 'react';
// Responder reports reuse the admin reports UI but can be restricted later
import AdminReports from './Admin-Reports';

export default function ResponderReports(props) {
  // For now, pass props through (token/session) so the UI works identical to admin.
  return <AdminReports {...props} />;
}
