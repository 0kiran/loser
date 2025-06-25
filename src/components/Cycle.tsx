import React, { useState, useEffect } from "react";

const placeholderText = [
  "nɐɹᴉʞʞ",
  "2",
  "nɐɹᴉʞʞ",
  // Additional placeholder texts can be added here
];

const Cycle: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex === placeholderText.length - 1 ? 0 : prevIndex + 1));
    }, 1500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <p>{placeholderText[index]}</p>;
};

export default Cycle;