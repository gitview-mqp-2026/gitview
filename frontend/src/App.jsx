import { Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import TeamDashboard from "./pages/TeamDashboard";
import TeamIndex from "./pages/TeamIndex";
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
                        <TeamIndex />
                    </ProtectedRoute>
                )}
            />

            <Route
                path="/team/:teamId"
                element={(
                    <ProtectedRoute>
                        <TeamDashboard />
                    </ProtectedRoute>
                )}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
