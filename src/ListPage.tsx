import React, { useContext, useEffect, useState } from "react";
import ReactSwitch from "react-switch";
import { ThemeContext } from "./context/ThemeContext";
import { Link } from "react-router-dom";
import { GOOGLE_SCRIPT_URL } from "./Home";
import axios from 'axios';
import { motion } from "framer-motion";


type Entry = {
    name: string;
    guests: string;
    phone: string;
};

const ListPage: React.FC = () => {
    let themeContext = useContext(ThemeContext);
    if (!themeContext) {
        // You can handle the error or provide default values
        themeContext = { theme: "light", toggleTheme: () => { } };
    }
    const { theme, toggleTheme } = themeContext;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);
    const loadingVariants = ["|", "/", "-", "\\"];

    const loadData = async () => {
        const response = await axios.get(GOOGLE_SCRIPT_URL);
        setEntries(response.data);
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!entries || entries.length === 0) {
            const interval = setInterval(() => {
                setLoadingTextIndex((prev) => (prev + 1) % loadingVariants.length);
            }, 120);
            return () => clearInterval(interval);
        }
    }, [entries]);

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
                <Link
                    to="/"
                    style={{
                        textDecoration: "none",
                        color: theme === "dark" ? "#fff" : "#000",
                    }}
                >
                    <h1>ｋｉｒａｎ . wtf</h1>
                </Link>
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
                <h1 style={{ marginBottom: "24px" }}>Who's Going</h1>
                <h5 style={{ color: "gray", textAlign: "center" }}>Name, add'l ppl</h5>
                {entries && entries.length > 0 ? (
                    <ul>
                        {entries.map((entry, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <li style={{ listStyleType: "none", textAlign: "left" }}>
                                    {entry.name} {parseInt(entry.guests) > 0 ? `, ${entry.guests}` : ""}
                                </li>
                            </motion.div>
                        ))}
                    </ul>
                ) : (
                    <h6
                        style={{
                            color: "gray",
                            textAlign: "center",
                            fontFamily: "'Courier New', Courier, monospace" // Use a different font for loading text
                        }}
                    >
                        {loadingVariants[loadingTextIndex]}
                    </h6>
                )}

                <h6 style={{ color: "gray", textAlign: "center" }}>total count: {entries.reduce((acc, entry) => acc + (1 + parseInt(entry.guests) || 0), 0)}</h6>

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
                                    window.location.href = "/";
                                }, 200); // match transition duration
                            } else {
                                window.location.href = "/";
                            }
                        }}
                    >
                        <span className="arrow">{'<'}</span>  rsvp
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
                                            transform: translateX(-10px);
                                            }
                                            `}
                        </style>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ListPage;