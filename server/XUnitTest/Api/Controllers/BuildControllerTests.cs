using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Text.Json;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Devops.DomainService.DataGatewayDeployment.Services;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Deployment.Models.Response;
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
        // Mirrors the wire format the client actually receives, so contract assertions are
        // made against the serialized shape rather than against C# property names.
        private static string Serialize(object value) =>
            JsonSerializer.Serialize(
                value,
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

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
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("id", It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync(new List<Build>());
            _f.RepoRepo.Setup(r => r.GetRepo("id")).ReturnsAsync(new Repo());
            (await CreateController().GetRepoDetails("id")).Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetRepoDetails_RepoNull_ReturnsBadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("id", It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync(new List<Build>());
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
    
        [Fact]
        public async Task GetRepoDetails_ReturnsTheRepoWithItsBuildHistory()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("repo-1", It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([new Build { ItemId = "build-1" }]);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1"))
                       .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "web" });

            var result = await CreateController().GetRepoDetails("repo-1");

            result.Should().BeOfType<OkObjectResult>();
            var body = (BaseApiResponse)((OkObjectResult)result).Value;
            body.IsSuccess.Should().BeTrue();
            body.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task GetRepoDetails_RejectsAnUnknownRepo()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([]);
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>())).ReturnsAsync((Repo)null);

            var result = await CreateController().GetRepoDetails("gone");

            result.Should().BeOfType<BadRequestObjectResult>();

            // Asserted on the serialized payload rather than a typed property: the body is
            // deliberately not a BaseApiResponse (its inherited Errors is a dictionary and
            // the contract calls for an array), so only the wire shape is meaningful here.
            var json = Serialize(((BadRequestObjectResult)result).Value);
            json.Should().Contain("\"isSuccess\":false");
            json.Should().Contain("\"statusCode\":400");
            json.Should().Contain("\"repo\":null");
            json.Should().Contain("\"build\":[]");
            json.Should().Contain("\"totalCount\":0");
            json.Should().Contain("\"message\":\"Repository not found\"");
            json.Should().Contain("\"errors\":[{\"code\":\"NOT_FOUND\",\"message\":\"Repository not found\"}]");
        }

        // C5: an existing repo with no builds is a 200 with an empty array, NOT a 400 and
        // not a null repo, and the rest of the success envelope has to stay intact.
        [Fact]
        public async Task GetRepoDetails_ValidRepoWithNoBuilds_Returns200AndAnEmptyBuildArray()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([]);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1"))
                       .ReturnsAsync(new Repo { ItemId = "repo-1", RepoName = "org/web" });

            var result = await CreateController().GetRepoDetails("repo-1");

            result.Should().BeOfType<OkObjectResult>();
            var json = Serialize(((OkObjectResult)result).Value);
            json.Should().Contain("\"isSuccess\":true");
            json.Should().Contain("\"build\":[]");
            json.Should().Contain("\"errors\":null");
            json.Should().Contain("\"message\":null");
            json.Should().Contain("org/web");
        }

        // H2: the defaults are part of the contract, so they are asserted on the arguments
        // the repository actually received rather than inferred from the response.
        [Fact]
        public async Task GetRepoDetails_WithoutPagingArguments_UsesPageOneAndThirty()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([]);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });

            await CreateController().GetRepoDetails("repo-1");

            _f.RepoRepo.Verify(r => r.GetRepoBuildList("repo-1", null, 1, 30), Times.Once);
        }

        [Fact]
        public async Task GetRepoDetails_PassesBranchAndPagingStraightThrough()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([]);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });

            await CreateController().GetRepoDetails("repo-1", "develop", 3, 5);

            _f.RepoRepo.Verify(r => r.GetRepoBuildList("repo-1", "develop", 3, 5), Times.Once);
        }

        [Fact]
        public async Task GetRepoDetails_DoesNotQueryBuildsForARepoThatDoesNotExist()
        {
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>())).ReturnsAsync((Repo)null);

            await CreateController().GetRepoDetails("gone");

            _f.RepoRepo.Verify(
                r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()),
                Times.Never);
            _f.RepoRepo.Verify(
                r => r.GetRepoBuildCount(It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        // The page on its own cannot tell a client how many pages follow it, so the total
        // has to reach the client with it.
        [Fact]
        public async Task GetRepoDetails_ReturnsTheTotalBuildCountAlongsideThePage()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList("repo-1", It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([new Build { ItemId = "build-1" }]);
            _f.RepoRepo.Setup(r => r.GetRepoBuildCount("repo-1", It.IsAny<string>()))
                       .ReturnsAsync(42);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });

            var result = await CreateController().GetRepoDetails("repo-1", pageNumber: 1, pageSize: 5);

            var json = Serialize(((OkObjectResult)result).Value);
            json.Should().Contain("\"totalCount\":42");
        }

        // A total counted over a different filter than the page is how a client ends up
        // paging into an empty tail, so the branch has to reach both calls.
        [Fact]
        public async Task GetRepoDetails_CountsOverTheSameBranchAsThePage()
        {
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ReturnsAsync([]);
            _f.RepoRepo.Setup(r => r.GetRepoBuildCount(It.IsAny<string>(), It.IsAny<string>()))
                       .ReturnsAsync(0);
            _f.RepoRepo.Setup(r => r.GetRepo("repo-1")).ReturnsAsync(new Repo { ItemId = "repo-1" });

            await CreateController().GetRepoDetails("repo-1", "develop", 3, 5);

            _f.RepoRepo.Verify(r => r.GetRepoBuildCount("repo-1", "develop"), Times.Once);
        }

        [Fact]
        public async Task GetRepoDetails_TurnsARepositoryFailureIntoABadRequest()
        {
            // The repo is resolved first now, so this has to succeed for the build query
            // to be reached at all - otherwise the test would pass on the not-found path
            // and prove nothing about failure handling.
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>()))
                       .ReturnsAsync(new Repo { ItemId = "repo-1" });
            _f.RepoRepo.Setup(r => r.GetRepoBuildList(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
                       .ThrowsAsync(new TimeoutException("mongo unreachable"));

            var result = await CreateController().GetRepoDetails("repo-1");

            result.Should().BeOfType<BadRequestObjectResult>();
            ((BaseApiResponse)((BadRequestObjectResult)result).Value)
                .Message.Should().Be("mongo unreachable");
        }

        [Fact]
        public async Task ManualBuild_RejectsARequestWithoutARepoId()
        {
            var result = await CreateController().ManualBuild(new RepoBuildRequest { RepoId = "" });

            var bad = result.Result.Should().BeOfType<BadRequestObjectResult>().Subject;
            ((BaseApiResponse)bad.Value).Message.Should().Be("Repo id is required");
        }

        [Fact]
        public async Task ManualBuild_ReportsAMissingRepoAsABadRequest()
        {
            _f.RepoRepo.Setup(r => r.GetRepo(It.IsAny<string>())).ReturnsAsync((Repo)null);

            var result = await CreateController().ManualBuild(new RepoBuildRequest { RepoId = "gone" });

            // ManualBuild answers "Repo not found." with an OK status code, so the controller
            // returns it as a success envelope rather than a 400.
            result.Result.Should().BeOfType<OkObjectResult>();
            ((BuildResponse)((OkObjectResult)result.Result).Value).Message.Should().Be("Repo not found.");
        }
}
}
