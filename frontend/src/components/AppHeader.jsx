import { Link } from "react-router-dom";

function AppHeader({ children, actions }) {
    return (
        <header className="nav-bar">
            <Link to="/" className="logo">GitView</Link>
            {children}
            <div className="nav-actions">{actions}</div>
        </header>
    );
}

export default AppHeader;
