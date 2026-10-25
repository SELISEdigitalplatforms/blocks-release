using System;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService.VersionControlSystems.RepositoryServices;
using Devops.DomainService.VersionControlSystems.TokenStore;
using Microsoft.Extensions.Logging;

namespace XUnitTest.TestDoubles;

/// <summary>Builds a <see cref="TokenRepository"/> over a test double of the secret value store.</summary>
internal static class GithubTokenStoreTestSupport
{
    public const string SecretIdPattern = "^github-token-[0-9a-f]{32}$";

    /// <param name="acceptAsKeyVault">
    /// Whether the double passes the repository's "is this Azure Key Vault" check. False exercises
    /// a host whose registered store is not Key Vault (C11).
    /// </param>
    public static TokenRepository CreateRepository(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        ILogger<TokenRepository> logger,
        IServiceProvider storeProvider,
        bool acceptAsKeyVault = true) =>
        new(dbContextProvider, logger, blocksSecret,
            new GithubTokenVault(storeProvider, logger, _ => acceptAsKeyVault));

    public static TokenRepository CreateRepository(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        ILogger<TokenRepository> logger,
        ISecretValueStore store,
        bool acceptAsKeyVault = true) =>
        CreateRepository(dbContextProvider, blocksSecret, logger, new StoreProvider(store), acceptAsKeyVault);

    /// <summary>Hands out the store and counts how often it was asked for.</summary>
    internal sealed class StoreProvider : IServiceProvider
    {
        private readonly ISecretValueStore? _store;
        private readonly Exception? _resolutionFailure;

        public StoreProvider(ISecretValueStore store) => _store = store;

        /// <summary>A provider whose store cannot be constructed (C15).</summary>
        public StoreProvider(Exception resolutionFailure) => _resolutionFailure = resolutionFailure;

        public int Resolutions { get; private set; }

        public object? GetService(Type serviceType)
        {
            if (serviceType != typeof(ISecretValueStore))
            {
                return null;
            }

            Resolutions++;
            if (_resolutionFailure is not null)
            {
                throw _resolutionFailure;
            }

            return _store;
        }
    }
}
