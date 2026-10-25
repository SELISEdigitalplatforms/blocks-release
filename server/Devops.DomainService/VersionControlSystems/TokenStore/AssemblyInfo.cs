using System.Runtime.CompilerServices;

// The unit tests replace the Key Vault store with a test double, which needs the internal
// GithubTokenVault constructor that takes the store-acceptance check.
[assembly: InternalsVisibleTo("XUnitTest")]
