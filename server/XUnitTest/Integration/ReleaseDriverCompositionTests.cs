using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Devops.DomainService;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Bson;
using Moq;
using ReleaseDriver;
using Xunit;

namespace XUnitTest.Integration
{
    /// <summary>
    /// H15 / C15: the blocks-monitor wiring. The host registers the driver through
    /// <see cref="ServiceRegistry.RegisterApplicationServices"/> only - it never calls
    /// <c>AddBlocksSecrets()</c> itself - and has no Key Vault settings. Constructing the driver and
    /// using its repository endpoints must not touch the secret value store at all, and a token
    /// read on a vault-format row must report the token store, not crash or claim "not authorized".
    /// </summary>
    /// <remarks>
    /// <c>AddBlocksSecrets()</c> and the Key Vault store read <c>KeyVault__KeyVaultUrl</c> and
    /// <c>Secrets__ValueStore</c> from the process environment, so each test pins both from start to
    /// end and restores them afterwards. Nothing else in the test project calls <c>AddBlocksSecrets()</c>.
    /// </remarks>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class ReleaseDriverCompositionTests : IDisposable
    {
        private const string KeyVaultUrlVariable = "KeyVault__KeyVaultUrl";
        private const string ValueStoreVariable = "Secrets__ValueStore";
        private static readonly string[] Roles = ["role"];
        private static readonly string[] Permissions = ["perm"];

        private readonly MongoIntegrationFixture _fixture;
        private readonly string? _previousUrl = Environment.GetEnvironmentVariable(KeyVaultUrlVariable);
        private readonly string? _previousStore = Environment.GetEnvironmentVariable(ValueStoreVariable);
        private readonly string _userId = Guid.NewGuid().ToString("N");
        private int _valueStoreConstructions;

        public ReleaseDriverCompositionTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            // Pinned for the whole test: registration reads these, and so does constructing the
            // Key Vault store, so a host-level KeyVault__KeyVaultUrl must not leak in.
            Environment.SetEnvironmentVariable(KeyVaultUrlVariable, null);
            Environment.SetEnvironmentVariable(ValueStoreVariable, null);
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-1", Roles, _userId, true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", Permissions, "octo",
                "phone", "display", "oauth", "tenant-1"));
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
            Environment.SetEnvironmentVariable(KeyVaultUrlVariable, _previousUrl);
            Environment.SetEnvironmentVariable(ValueStoreVariable, _previousStore);
        }

        /// <summary>Builds the container the way blocks-monitor does, with the given environment.</summary>
        private ServiceProvider BuildMonitorLikeContainer(string? valueStore)
        {
            var services = new ServiceCollection();

            // The Genesis/host registrations a driver consumer brings, as test doubles.
            var blocksSecret = new Mock<IBlocksSecret>();
            blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            blocksSecret.SetupGet(s => s.RootDatabaseName).Returns(_fixture.DatabaseName);
            var hostEnvironment = new Mock<IHostEnvironment>();
            hostEnvironment.SetupGet(h => h.EnvironmentName).Returns(Environments.Production);
            services.AddLogging();
            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
            services.AddSingleton(hostEnvironment.Object);
            services.AddSingleton(_fixture.DbContextProvider);
            services.AddSingleton(blocksSecret.Object);
            services.AddSingleton(Mock.Of<ITenants>());
            services.AddSingleton(Mock.Of<IMessageClient>());
            services.AddSingleton(Mock.Of<ICryptoService>());
            services.AddSingleton(Mock.Of<IHttpClientFactory>());
            services.AddSingleton(Mock.Of<IHttpService>());

            Environment.SetEnvironmentVariable(ValueStoreVariable, valueStore);

            // What RegisterBlocksReleaseServicesAsync does, minus reading the cloud build vault.
            services.RegisterApplicationServices(Mock.Of<ICloudBuildSecret>());
            services.AddScoped<IReleaseDriverService, ReleaseDriverService>();

            CountValueStoreConstructions(services);
            return services.BuildServiceProvider();
        }

        /// <summary>Wraps the registered value store so every construction attempt is counted.</summary>
        private void CountValueStoreConstructions(IServiceCollection services)
        {
            var original = services.Single(d => d.ServiceType == typeof(ISecretValueStore));
            services.Remove(original);
            services.Add(new ServiceDescriptor(typeof(ISecretValueStore), sp =>
            {
                _valueStoreConstructions++;
                return original.ImplementationFactory is not null
                    ? original.ImplementationFactory(sp)
                    : ActivatorUtilities.CreateInstance(sp, original.ImplementationType!);
            }, original.Lifetime));
        }

        [Fact]
        public async Task DriverConstructsAndServesRepositoryEndpointsWithoutTouchingTheValueStore()
        {
            // H15, C15 (operations that never read a token are unaffected)
            var buildId = Guid.NewGuid().ToString("N");
            await _fixture.Collection<Build>("Builds").InsertOneAsync(
                new Build { ItemId = buildId, RepoName = "org/repo", Branch = "main" });
            using var provider = BuildMonitorLikeContainer(valueStore: null);
            using var scope = provider.CreateScope();

            var driver = scope.ServiceProvider.GetRequiredService<IReleaseDriverService>();
            var repos = await driver.GetReposListAsync();
            var details = await driver.GetRepoDetailsAsync(Guid.NewGuid().ToString("N"));
            // An unrecognised report type reads the build and stops before any analysis server call.
            var reports = await driver.GetReportsAsync(buildId, "none");

            driver.Should().NotBeNull();
            repos.IsSuccess.Should().BeTrue();
            details.Message.Should().Be("Repository not found");
            reports.IsSuccess.Should().BeTrue();
            _valueStoreConstructions.Should().Be(0);
        }

        [Fact]
        public async Task KeyVaultRequestedWithoutUrlReportsTokenStoreForVaultRows()
        {
            // C15: Secrets__ValueStore=KeyVault with no KeyVault__KeyVaultUrl - the store cannot be
            // constructed. The driver still constructs; isAuthorized on a vault-format row answers
            // with the TokenStore body instead of failing or asking the user to reconnect.
            await _fixture.Collection<BsonDocument>("RepositoryTokens").InsertOneAsync(new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString("N") },
                { nameof(RepositoryToken.BlocksUserId), _userId },
                { nameof(RepositoryToken.TokenSecretId), "github-token-" + Guid.NewGuid().ToString("N") }
            });
            using var provider = BuildMonitorLikeContainer(valueStore: "KeyVault");
            using var scope = provider.CreateScope();

            var driver = scope.ServiceProvider.GetRequiredService<IReleaseDriverService>();
            _valueStoreConstructions.Should().Be(0, "constructing the driver must not build the store");

            var result = await driver.IsAuthorizeAsync();

            const string message = "Could not validate your GitHub connection. Please try again later.";
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            result.Message.Should().Be(message);
            result.Errors.Should().ContainSingle().Which.Should().Be(
                new System.Collections.Generic.KeyValuePair<string, string>("TokenStore", message));
            _valueStoreConstructions.Should().Be(1);
            (await driver.GetReposListAsync()).IsSuccess.Should().BeTrue();
        }

        [Fact]
        public void KeyVaultRequestedWithoutUrlRegistersTheKeyVaultStore()
        {
            // Guards the assumption above: with that setting, the registered store is Key Vault
            // and it is the store's construction (not registration) that fails.
            using var provider = BuildMonitorLikeContainer(valueStore: "KeyVault");

            var act = () => provider.GetRequiredService<ISecretValueStore>();

            act.Should().Throw<InvalidOperationException>().WithMessage("*KeyVault*");
        }
    }
}
