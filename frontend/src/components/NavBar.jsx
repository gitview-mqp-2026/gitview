import AppHeader from "./AppHeader.jsx";
import Breadcrumbs from "./Breadcrumbs.jsx";
import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";
import { HOME_CRUMBS } from "../utils/breadcrumbs.js";
import "../App.css";

// Each page says where it is. Guessing from the URL showed raw ids ("/ Course / 1") and linked to pages that do
// not exist ("/course").
function NavBar({ crumbs = HOME_CRUMBS }) {
    return (
        <AppHeader actions={(
            <>
                <div className="inbox-button" />
                <div className="nav-account">
                    <Profile />
                    <LogoutButton />
                </div>
            </>
        )}>
            <Breadcrumbs crumbs={crumbs} />
        </AppHeader>
    );
}

export default NavBar;
