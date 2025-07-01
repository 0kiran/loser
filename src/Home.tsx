import { motion } from "framer-motion";
import React, { useState } from "react";
import { useNavigate, Link, } from "react-router-dom";
import ReactSwitch from "react-switch";
import axios from 'axios';


export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzidRVJtrIzY9gNxMfPQfk9N9-XFAdPRcOiXXlgSlzgkDUCz8vDDBoYA3Q8YLfZaOA6FQ/exec";

interface HomeProps {
  theme: string;
  toggleTheme: () => void;
}

const Home: React.FC<HomeProps> = ({ theme, toggleTheme }) => {
  // Initialize theme from localStorage or default to "light"

  const [phone, setPhone] = useState('');
  const [formData, setFormData] = useState({ name: '', guests: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.5,
      },
    },
  };

  const itemVariants = {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
  };

  function formatPhoneNumber(value: string) {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    const match = digits.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return value;

    let formatted = '';
    if (match[1]) formatted += `(${match[1]}`;
    if (match[1] && match[1].length === 3) formatted += ') ';
    if (match[2]) formatted += match[2];
    if (match[2] && match[2].length === 3) formatted += '-';
    if (match[3]) formatted += match[3];

    return formatted;
  }


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChangePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatPhoneNumber(input);
    setPhone(formatted);
    setFormData({ ...formData, [e.target.name]: formatted });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(GOOGLE_SCRIPT_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      navigate("/list");
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();
  return (
    <div
      className="App"
      id={theme}
      style={{
        backgroundColor: theme === "dark" ? "#000" : "#fff",
        minHeight: "100vh",
        width: "100vw",
        color: theme === "dark" ? "#fff" : "#000",
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={itemVariants}>
            <Link
              to="/"
              style={{
                textDecoration: "none",
                color: theme === "dark" ? "#fff" : "#000",
              }}
            >
              <h1>ｋｉｒａｎ . wtf</h1>
            </Link>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="switch">
              <label style={{ marginRight: "20px" }}>
                {theme === "light" ? "ʕ´• ᴥ•̥`ʔ" : "(っ´ω｀c)"}
              </label>
              <ReactSwitch
                onChange={toggleTheme}
                checked={theme === "dark"}
                onColor="#888"
                offColor="#000"
                checkedIcon={false}
                uncheckedIcon={false}
                className="swt"
              />
            </div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="postdate">
              <h5>kiran's birthday</h5>
              <h5>
                <a
                  href="https://maps.app.goo.gl/rqKUVn4tGiaZxnk79"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "grey",
                    textDecoration: "underline",
                  }}
                >
                  bar goto niban
                </a>
              </h5>
              <h5>7/19 8-12</h5>
              <h5>rsvp below:</h5>
            </div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="post">
              <form
                onSubmit={handleSubmit}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "20px",
                  borderRadius: "0",
                  maxWidth: "320px",
                  margin: "0 auto",
                  boxShadow: theme === "dark" ? "0 2px 8px #222" : "0 2px 8px #eee",
                  fontFamily: "inherit",
                }}
              >
                <input
                  type="text"
                  name="name"
                  placeholder="name"
                  onChange={handleChange}
                  required
                  style={{
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    background: theme === "dark" ? "#222" : "#fff",
                    color: theme === "dark" ? "#fff" : "#000",
                    outline: "none",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                />
                <input
                  type="number"
                  name="guests"
                  min={0}
                  placeholder="add'l ppl"
                  onChange={handleChange}
                  style={{
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    background: theme === "dark" ? "#222" : "#fff",
                    color: theme === "dark" ? "#fff" : "#000",
                    outline: "none",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                />
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  placeholder="phone (optional)"
                  value={phone}
                  onChange={handleChangePhone}
                  maxLength={14} // (123) 456-7890 is 14 chars
                  style={{
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    background: theme === "dark" ? "#222" : "#fff",
                    color: theme === "dark" ? "#fff" : "#000",
                    outline: "none",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    background: theme === "dark" ? "#444" : "#888",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "1rem",
                    transition: "background 0.2s",
                    fontFamily: "inherit",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? (
                    <span
                      style={{
                        display: "inline-block",
                        width: "20px",
                        height: "20px",
                        border: "3px solid #fff",
                        borderTop: "3px solid #888",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  ) : (
                    "submit"
                  )}
                  <style>
                    {`
                                @keyframes spin {
                                  0% { transform: rotate(0deg);}
                                  100% { transform: rotate(360deg);}
                                }
                              `}
                  </style>
                </button>
              </form>
              <div className="posttext">
                <Link
                  to="#"
                  style={{
                    display: "inline-block",
                    color: theme === "dark" ? "#fff" : "#000",
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: "1rem",
                    transition: "color 0.2s",
                    position: "relative",
                    marginTop: "20px",
                  }}
                  className="whos-going-link"
                  onClick={(e: { preventDefault: () => void; }) => {
                    e.preventDefault();
                    const arrow = document.querySelector('.whos-going-link .arrow');
                    if (arrow) {
                      arrow.classList.add('animate-arrow');
                      setTimeout(() => {
                        navigate("/list");
                      }, 200); // match transition duration
                    } else {
                      navigate("/list");
                    }
                  }}
                >
                  who's going <span className="arrow">{'>'}</span>
                  <style>
                    {`
                            .whos-going-link .arrow {
                            display: inline-block;
                            transition: transform 0.2s;
                            }
                            .whos-going-link:hover .arrow,
                            .whos-going-link:active .arrow,
                            .whos-going-link:focus .arrow,
                            .whos-going-link .arrow.animate-arrow {
                            transform: translateX(10px);
                            }
                            `}
                  </style>
                </Link>
              </div>
            </div>
          </motion.div>
          <motion.div variants={itemVariants}>

          </motion.div>
        </motion.div>
      </div>
    </div >
  );

};
export default Home;