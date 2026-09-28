import "../App.css";
import { Link } from "react-router-dom";

function Home() {
    return (
        <div>
            <header className="nav-bar">
                <div className="logo">GitView</div>
                <div className="file-path"></div>

                <div className="nav-actions">
                    <div className="inbox-button"></div>
                    <div className="profile-button"></div>
                </div>
            </header>

            <div className="actions">
                <div class="analyze-repo">
                    <input className="repo-input" type="text"></input>
                    <button className="repo-button">Analyze Repo</button>
                </div>
                
                <Link to="/team" className="link-button">
                    Go to Team Dashboard
                </Link>
            </div>
        </div>
    );
}

export default Home;