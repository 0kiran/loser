import "./index.css";
import "sanitize.css";
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeContext } from "./context/ThemeContext";
import ListPage from "./ListPage";
import Home from "./Home";

const App: React.FC = () => {

  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  // Update localStorage whenever theme changes
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((curr) => (curr === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                theme={theme}
                toggleTheme={toggleTheme}
              />
            }
          />
          <Route path="/list" element={<ListPage />} />
        </Routes>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;