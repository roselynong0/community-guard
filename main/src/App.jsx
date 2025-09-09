// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RegistrationForm from "./components/RegistrationForm";
import LoginForm from "./components/LoginForm";
import Layout from "./components/Layout";
import Home from "./components/Home";

function App() {
  return (
    <Router>
      <Routes>
        {/* No sidebar layout */}
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/login" element={<LoginForm />} />

        {/* With sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/reports" element={<div>Reports</div>} />
          <Route path="/notifications" element={<div>Notifications</div>} />
          <Route path="/profile" element={<div>Profile</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
