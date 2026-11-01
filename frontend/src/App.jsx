import { Navigate, Route, Routes } from "react-router-dom";

import InstructorDashboard from "./pages/InstructorDashboard";
import Login from "./pages/Login";
import TeamDashboard from "./pages/TeamDashboard";
import TeamIndex from "./pages/TeamIndex";
import FileAlignment from "./pages/FileAlignment";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import SectionDashboard from "./pages/SectionDashboard.jsx";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="/"
                element={(
                    <ProtectedRoute>
                        <InstructorDashboard />
                    </ProtectedRoute>
                )}
            />

            <Route
                path="/section"
                element={(
                    <ProtectedRoute>
                        <SectionDashboard />
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
