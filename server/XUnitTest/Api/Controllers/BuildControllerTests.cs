using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Models;
using FluentAssertions;
using FluentValidation.Results;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;
using XUnitTest.Devops.Deployment;

namespace XUnitTest.Api.Controllers
{
    public class BuildControllerTests : IDisposable
    {
        private readonly DeploymentServiceFactory _f = new();
        private readonly Mock<IDataGatewayDeploymentService> _dataGateway = new();

        private BuildController CreateController() =>
            new(_f.BuildService(), _f.BuildRepo.Object, _f.RepoRepo.Object, _f.TestReportService(), _dataGateway.Object);

        public void Dispose() => BlocksContext.ClearContext();

        [Fact]
        public async Task GetById_Found_ReturnsOk()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "r" });
            (await CreateController().GetById("b1")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetById_NotFound_ReturnsBadRequest()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync((Build)null);
            (await CreateController().GetById("b1")).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetReposList_Found_ReturnsOk()
        {
            _f.RepoRepo.Setup(r => r.GetRepos()).ReturnsAsync(new List<Repo> { new() });
            (await CreateController().GetReposList()).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetReposList_Null_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepos()).ReturnsAsync((List<Repo>)null);
            (await CreateController().GetReposList()).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetRepoDetails_RepoFound_ReturnsOk()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("id")).ReturnsAsync(new List<Build>());
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo());
            (await CreateController().GetRepoDetails("id")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetRepoDetails_RepoNull_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("id")).ReturnsAsync(new List<Build>());
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            (await CreateController().GetRepoDetails("id")).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task RunBuild_EmptyRepoId_ReturnsBadRequest()
        {
            (await CreateController().RunBuild(new RepoBuildRequest { RepoId = "" })).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task RunBuild_RepoNotFound_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync((Repo)null);
            (await CreateController().RunBuild(new RepoBuildRequest { RepoId = "id" })).Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task ManualBuild_EmptyRepoId_ReturnsBadRequest()
        {
            (await CreateController().ManualBuild(new RepoBuildRequest { RepoId = "" })).Result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task RepoSettingsUpdate_ReturnsOk()
        {
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo { ItemId = "id" });
            _f.RepoRepo.Setup(r => r.UpdateRepo(It.IsAny<RepoUpdateRequest>())).ReturnsAsync(true);
            _f.Webhook.Setup(w => w.UpdateWebhookStatus(It.IsAny<Repo>(), It.IsAny<bool>())).ReturnsAsync(true);
            (await CreateController().RepoSettingsUpdate(new RepoUpdateRequest { RepoId = "id" })).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task RepoDomainUpdateRequest_Success_ReturnsResponse()
        {
            BlocksContext.SetContext(BlocksContext.Create(
                "tenant", new[] { "role" }, "user", true, "uri", "org",
                DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
                "phone", "display", "oauth", "tenant"));
            _f.DomainValidator.Setup(v => v.ValidateAsync(It.IsAny<RepoDomainUpdateRequest>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(new ValidationResult());
            _f.RepoRepo.Setup(r => r.GetRepoCustomDomainsAsync(It.IsAny<List<RepoWithDomain>>(), It.IsAny<string>()))
              .ReturnsAsync(new List<RepoCustomDomain>());
            _f.RepoRepo.Setup(r => r.UpsertRepoCustomDomainsAsync(It.IsAny<List<RepoCustomDomain>>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });
            _f.RepoRepo.Setup(r => r.UpdateRepoDomain(It.IsAny<RepoDomainUpdateRequest>()))
              .ReturnsAsync(new BulkOperationSummary { IsAcknowledged = true });

            var response = await CreateController().RepoDomainUpdateRequest(new RepoDomainUpdateRequest
            {
                ProjectEnv = "prod",
                repoWithDomains = new List<RepoWithDomain>()
            });
            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task GetHostingProviders_ReturnsOk()
        {
            _f.BuildRepo.Setup(b => b.GetHostingProviders()).ReturnsAsync(new List<HostingProvider>());
            (await CreateController().GetHostingProviders()).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetReports_ReturnsOk()
        {
            _f.BuildRepo.Setup(b => b.GetBuild("b1")).ReturnsAsync(new Build { RepoName = "org/r", Branch = "main" });
            (await CreateController().GetReports("b1", "dast")).Should().BeOfType<OkObjectResult>();
        }
    }
}
