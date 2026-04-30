const generateRandomState = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const authenticateWithGithub = (extraState: string) => {
  const randomState = generateRandomState();
  // const stringifiedState = JSON.stringify({ extraState, randomState });
  // const b64 = btoa(stringifiedState);
  // const state = extraState ? `${b64}` : randomState;

  // Define scopes for personal repository access
  const scopes = ["repo", "user:email", "read:user", "read:repo_hook"].join(" ");

  // Build the OAuth URL with all parameters
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_GITHUB_SSO_CLIENT_ID as string);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", randomState);

  // window.history.pushState({}, document.title, window.location.pathname);
  // window.location.assign(authUrl.toString());
  // Open in a new tab
  window.open(authUrl.toString(), "_blank", "noopener,noreferrer");
};

// Function to verify state parameter when handling the callback
const verifyOAuthState = (receivedState: string | null) => {
  const tempStorage = (window as any).tempOAuthStorage;
  const storedState = tempStorage?.github_oauth_state;
  if (tempStorage) {
    delete (window as any).tempOAuthStorage;
  }
  return storedState === receivedState;
};

const authenticateWithGitlab = () => console.log("GitLab auth");
const authenticateWithBitbucket = () => console.log("Bitbucket auth");
const authenticateWithAzure = () => console.log("Azure auth");
const authenticateWithAws = () => console.log("AWS auth");

export {
  authenticateWithGithub,
  verifyOAuthState,
  authenticateWithGitlab,
  authenticateWithBitbucket,
  authenticateWithAzure,
  authenticateWithAws,
};
