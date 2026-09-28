import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TeamDashboard from "./pages/TeamDashboard";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/team" element={<TeamDashboard/>}/>
            </Routes>
        </BrowserRouter>
    );
}

export default App;