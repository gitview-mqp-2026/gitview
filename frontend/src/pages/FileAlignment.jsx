import "../App.css";
import { Link } from "react-router-dom";

import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";
import FileList from "../components/FileList.jsx";

// sample file directory structure
const fileDirectory = [
    {
        name: "app",
        path: "app",
        subfolders: [
            {
                name: "auth",
                path: "app/auth",
                subfolders: [
                    {
                        name: "auth_forms.py",
                        path: "app/auth/auth_forms.py",
                    },
                    {
                        name: "auth_routes.py",
                        path: "app/auth/auth_routes.py",
                    },
                ],
            },
            {
                name: "css",
                path: "app/css",
                subfolders: [
                    {
                        name: "main.css",
                        path: "app/css/main.css",
                    },
                ],
            },
            {
                name: "main",
                path: "app/main",
                subfolders: [
                    {
                        name: "routes.py",
                        path: "app/main/routes.py",
                    },
                    {
                        name: "models.py",
                        path: "app/main/models.py",
                    },
                    {
                        name: "templates",
                        path: "app/main/templates",
                        subfolders: [
                            {
                                name: "base.html",
                                path: "app/main/templates/base.html",
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "tests",
        path: "tests",
        subfolders: [
            {
                name: "test_routes.py",
                path: "tests/test_routes.py",
            },
        ],
    },
];

function FileAlignment() {
    return (
        <div>
            <header className="nav-bar">
                <Link to="/" className="logo">GitView</Link>

                <div className="file-path"></div>

                <div className="nav-actions">
                    <div className="inbox-button"></div>

                    <div className="nav-account">
                        <Profile />
                        <LogoutButton />
                    </div>
                </div>
            </header>

            <div className="file-directory-title">File Directory</div>

            <div className="two-columns">
                <div className="file-tree">
                    <FileList fileList={fileDirectory} />
                </div>

                <div>
                    <div className="file-tags">
                        <h2>File Tags</h2>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FileAlignment;
