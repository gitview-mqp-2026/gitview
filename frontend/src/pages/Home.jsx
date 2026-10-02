import "../App.css";
import { Link } from "react-router-dom";

import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";

function Home() {
    return (
        <div>
            <header className="nav-bar">
                <div className="logo">GitView</div>

                <div className="file-path"></div>

                <div className="nav-actions">
                    <div className="inbox-button"></div>

                    <div className="nav-account">
                        <Profile />
                        <LogoutButton />
                    </div>
                </div>
            </header>

            <div className="actions">
                <div className="analyze-repo">
                    <input
                        className="repo-input"
                        type="text"
                    />

                    <button className="repo-button">
                        Analyze Repo
                    </button>
                </div>

                <Link to="/team" className="link-button">
                    Go to Team Dashboard
                </Link>
            </div>
        </div>
    );
}

export default Home;
