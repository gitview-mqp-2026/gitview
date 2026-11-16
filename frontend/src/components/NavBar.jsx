import { Link } from "react-router-dom";

import Breadcrumbs from "./Breadcrumbs.jsx";
import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";
import "../App.css";

const DEFAULT_CRUMBS = [{ label: "Courses" }];

function NavBar({ crumbs = DEFAULT_CRUMBS }) {
    return (
        <header className="nav-bar">
            <Link to="/" className="logo">GitView</Link>

            <Breadcrumbs crumbs={crumbs} />

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
