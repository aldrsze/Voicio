import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { GeneratorPage } from "./pages/GeneratorPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="app" element={<GeneratorPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
