import { Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import AuthConfigurationError from "./AuthConfigurationError.jsx";
import { getSafeReturnPath } from "../../utils/authNavigation.js";

const auth0Config = {
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
};

function AuthProvider({ children }) {
    const navigate = useNavigate();

    if (!auth0Config.domain || !auth0Config.clientId) {
        return <AuthConfigurationError />;
    }

    const handleRedirect = (appState) => {
        navigate(getSafeReturnPath(appState?.returnTo), { replace: true });
    };

    return (
        <Auth0Provider
            {...auth0Config}
            authorizationParams={{
                redirect_uri: window.location.origin,
                scope: "openid profile email",
            }}
            onRedirectCallback={handleRedirect}
        >
            {children}
        </Auth0Provider>
    );
}

export default AuthProvider;
