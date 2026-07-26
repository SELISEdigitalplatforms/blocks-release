using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Dtos;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Deployment.Services;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Models;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;

namespace XUnitTest.Devops.Deployment
{
    public class VcsRepositoryServiceTests : IDisposable
    {
        private readonly Mock<IBuildRepository> _buildRepo = new();
        private readonly Mock<IRepoRepository> _repoRepo = new();
        private readonly Mock<IValidator<RepoDomainUpdateRequest>> _validator = new();

        public VcsRepositoryServiceTests()
        {
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant-vcs", new[] { "role" }, "user-1", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant-vcs"));
        }

        public void Dispose() => BlocksContext.ClearContext();

        private VcsRepositoryService CreateService() =>
            new(new Mock<ILogger<VcsRepositoryService>>().Object, _buildRepo.Object, _repoRepo.Object, _validator.Object);

        // ---- GetBuildWithRepo ----

        [Fact]
        public async Task GetBuildWithRepo_Found_ReturnsBuild()
        {
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync(new Build { RepoName = "r" });
            (await CreateService().GetBuildWithRepo("bid")).Should().NotBeNull();
        }

        [Fact]
        public async Task GetBuildWithRepo_NotFound_ReturnsNull()
        {
            _buildRepo.Setup(b => b.GetBuild("bid")).ReturnsAsync((Build)null);
            (await CreateService().GetBuildWithRepo("bid")).Should().BeNull();
        }

        // ---- GetRepos ----

        [Fact]
        public async Task GetRepos_ReturnsList()
        {
            var repos = new List<RepoWithBuildsResponse> { new() };
            _repoRepo.Setup(r => r.GetReposWithBuildsAsync("p")).ReturnsAsync(repos);
            (await CreateService().GetRepos("p")).Should().HaveCount(1);
        }

        // ---- UpdateRepo ----

        [Fact]
        public async Task UpdateRepo_RepoNotFound_ReturnsBadRequest()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            var result = await CreateService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task UpdateRepo_Success_ReturnsOk()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { DeploymentType = "Manual" });
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);
            var result = await CreateService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task UpdateRepo_WithDeploySettingsAndAutoType_ResolvesSettings()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { DeploymentType = "Manual" });
            _repoRepo.Setup(r => r.GetDeploySettings("h", "reg", "m")).ReturnsAsync(new DeploySettings());
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);
            var request = new RepoUpdateRequest { RepoId = "id", HostingProviderId = "h", RegionId = "reg", MachineConfigId = "m", DeploymentType = "Auto" };
            var result = await CreateService().UpdateRepo(request);
            result.IsSuccess.Should().BeTrue();
            request.DeploymentType.Should().Be("Auto");
            _repoRepo.Verify(r => r.GetDeploySettings("h", "reg", "m"), Times.Once);
        }

        [Fact]
        public async Task UpdateRepo_UpdateReturnsFalse_ReturnsNotFoundFallback()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { DeploymentType = "Manual" });
            _repoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(false);
            var result = await CreateService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateRepo_Exception_ReturnsFailure()
        {
            _repoRepo.Setup(r => r.GetRepo("id")).ThrowsAsync(new InvalidOperationException("boom"));
            var result = await CreateService().UpdateRepo(new RepoUpdateRequest { RepoId = "id" });
            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Contain("Failed to update repository");
        }

        // ---- UpdateRepoDomain ----

        [Fact]
        public async Task UpdateRepoDomain_InvalidRequest_ReturnsErrors()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("ProjectEnv", "required") }));
            var result = await CreateService().UpdateRepoDomain(new RepoDomainUpdateRequest());
            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("ProjectEnv");
        }

        [Fact]
        public async Task UpdateRepoDomain_Success_ReturnsOk()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
                     .ReturnsAsync(new List<RepoCustomDomain>());
            _repoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()))
                     .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });
            _repoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>()))
                     .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true, ModifiedCount = 2 });

            var request = new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain> { new() { RepoId = "r1", CustomDeploymentDomain = "d.com", RepoUrl = "u" } }
            };
            var result = await CreateService().UpdateRepoDomain(request);

            result.IsSuccess.Should().BeTrue();
            result.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task UpdateRepoDomain_NotAcknowledged_ReturnsSomethingWrong()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
                     .ReturnsAsync(new List<RepoCustomDomain>());
            _repoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()))
                     .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });
            _repoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>()))
                     .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = false });

            var result = await CreateService().UpdateRepoDomain(new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain>()
            });

            result.IsSuccess.Should().BeFalse();
            result.Message.Should().Be("Something went wrong.");
        }

        [Fact]
        public async Task UpdateRepoDomain_Exception_ReturnsBadRequest()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
                      .ThrowsAsync(new InvalidOperationException("boom"));
            var result = await CreateService().UpdateRepoDomain(new RepoDomainUpdateRequest());
            result.IsSuccess.Should().BeFalse();
            result.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        // ---- TransformToRepoCustomDomains ----

        [Fact]
        public async Task TransformToRepoCustomDomains_NullDomains_ReturnsEmpty()
        {
            var result = await CreateService().TransformToRepoCustomDomains(new RepoDomainUpdateRequest { repoWithDomains = null });
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task TransformToRepoCustomDomains_NewAndExisting_MergesCorrectly()
        {
            var existing = new RepoCustomDomain { RepoId = "r1", ProjectId = "tenant-vcs", ProjectEnv = "prod", CustomDeploymentDomain = "old.com" };
            _repoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
                     .ReturnsAsync(new List<RepoCustomDomain> { existing });

            var request = new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain>
                {
                    new() { RepoId = "r1", CustomDeploymentDomain = "new.com", RepoUrl = "u1" }, // existing -> updated
                    new() { RepoId = "r2", CustomDeploymentDomain = "d2.com", RepoUrl = "u2" },   // new
                    new() { RepoId = "", CustomDeploymentDomain = "skip" }                          // skipped
                }
            };

            var result = await CreateService().TransformToRepoCustomDomains(request);

            result.Should().HaveCount(2);
            result.First(d => d.RepoId == "r1").CustomDeploymentDomain.Should().Be("new.com");
            result.Should().Contain(d => d.RepoId == "r2");
        }
    }
}
