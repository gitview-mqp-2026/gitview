import { Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import TeamDashboard from "./pages/TeamDashboard";
import FileAlignment from "./pages/FileAlignment";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="/"
                element={(
                    <ProtectedRoute>
                        <Home />
                    </ProtectedRoute>
                )}
            />

            <Route
                path="/team"
                element={(
                    <ProtectedRoute>
                        <TeamDashboard />
                    </ProtectedRoute>
                )}
            />

            <Route
                path="/alignment"
                element={(
                    <ProtectedRoute>
                        <FileAlignment />
                    </ProtectedRoute>
                )}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
