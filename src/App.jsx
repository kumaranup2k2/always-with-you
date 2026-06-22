import { useState } from "react";
import "./App.css";
import CoverPage from "./components/CoverPage";
import DiaryBook from "./components/DiaryBook";

export default function App() {
  const [screen, setScreen] = useState("cover");

  return screen === "cover"
    ? <CoverPage onOpen={() => setScreen("diary")} />
    : <DiaryBook onClose={() => setScreen("cover")} />;
}