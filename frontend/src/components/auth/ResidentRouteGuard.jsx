import React from "react";
import { Navigate } from "react-router-dom";

// Component to protect resident routes  
function ResidentRouteGuard({ session, children }) {
  // If no session, redirect to login
  if (!session) {
    return <Navigate to="/login?role=resident" replace />;
  }

  // If user is an admin, redirect to admin dashboard
  if (session.user?.role === "Admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // If user is resident, render the protected content
  return children;
}

export default ResidentRouteGuard;