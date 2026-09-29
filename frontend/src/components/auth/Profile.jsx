import { useAuth0 } from "@auth0/auth0-react";

function Profile() {
  const {
    user,
    isAuthenticated,
    isLoading,
  } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <img
        src={user?.picture}
        alt={user?.name || "Profile"}
      />

      <div>{user?.name}</div>
      <div>{user?.email}</div>
    </div>
  );
}

export default Profile;
