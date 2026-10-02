import { useAuth0 } from "@auth0/auth0-react";

function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="profile-summary" aria-label="Loading profile">
        <span className="profile-avatar profile-avatar-loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = user?.name || user?.nickname || user?.email || "User";
  const showEmail = user?.email && user.email !== displayName;
  const initials = displayName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="profile-summary" title={user?.email || displayName}>
      {user?.picture ? (
        <img
          className="profile-avatar"
          src={user.picture}
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">
          {initials || "U"}
        </span>
      )}

      <div className="profile-copy">
        <span className="profile-name">{displayName}</span>
        {showEmail && <span className="profile-email">{user.email}</span>}
      </div>
    </div>
  );
}

export default Profile;
