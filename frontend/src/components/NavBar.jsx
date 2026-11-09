import { Link, useLocation } from "react-router-dom";

import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";
import "../App.css";

function NavBar() {
    const location = useLocation();

    const pathNames = {
        course: "Course",
        team: "Team",
    }

    const pathSegments = location.pathname.split("/").filter(Boolean);

    return (
        <header className="nav-bar">
            <Link to="/" className="logo">GitView</Link>

            <div className="file-path">
                {pathSegments.map((segment, index) => {
                    const path = "/" + pathSegments.slice(0, index + 1).join("/");
                    const label = pathNames[segment] || segment;

                    return (
                        <span key={path}>
                            / <Link to={path}>{label}</Link>
                        </span>
                    );
                })}
            </div>

            <div className="nav-actions">
                <div className="inbox-button"></div>

                <div className="nav-account">
                    <Profile />
                    <LogoutButton />
                </div>
            </div>
        </header>
    );
}

export default NavBar;