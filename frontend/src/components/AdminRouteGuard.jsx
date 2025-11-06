import React from "react";
import { Navigate } from "react-router-dom";

// Component to protect admin routes
function AdminRouteGuard({ session, children }) {
  // If no session, redirect to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If user is not an admin, redirect to resident home
  if (session.user?.role !== "Admin") {
    return <Navigate to="/home" replace />;
  }

  // If user is admin, render the protected content
  return children;
}

export default AdminRouteGuard;