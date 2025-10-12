import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Component to validate user role and logout if wrong role
function RoleValidator({ expectedRole, currentRole, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentRole && currentRole !== expectedRole) {
      console.log(`Role mismatch: expected ${expectedRole}, got ${currentRole}. Logging out...`);
      
      // Clear session data immediately
      localStorage.removeItem("token");
      
      // Call logout function if provided
      if (onLogout) {
        onLogout(null);
      }
      
      // Navigate to login
      navigate("/login", { replace: true });
    }
  }, [currentRole, expectedRole, navigate, onLogout]);

  return null; // This component doesn't render anything
}

export default RoleValidator;