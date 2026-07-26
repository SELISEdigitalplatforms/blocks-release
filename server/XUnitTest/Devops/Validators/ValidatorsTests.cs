using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Validators;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;

namespace XUnitTest.Devops.Validators
{
    public class BuildRequestValidatorTests
    {
        private static BuildRequest ValidRequest() => new()
        {
            repoName = "repo",
            repoUrl = "https://github.com/org/repo",
            branch = "main",
            projectName = "proj",
            deploymentUrl = "https://deploy.example.com",
            hostingProviderId = "hp1",
            regionId = "r1",
            machineConfigId = "mc1",
            deploymentType = "Auto"
        };

        [Fact]
        public void Validate_ValidRequest_Passes()
        {
            var validator = new BuildRequestValidator();

            var result = validator.Validate(ValidRequest());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void Validate_EmptyRepoUrl_Fails()
        {
            var validator = new BuildRequestValidator();
            var req = ValidRequest();
            req.repoUrl = "";

            var result = validator.Validate(req);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Repository URL is required.");
        }

        [Fact]
        public void Validate_InvalidRepoUrl_Fails()
        {
            var validator = new BuildRequestValidator();
            var req = ValidRequest();
            req.repoUrl = "not a uri";

            var result = validator.Validate(req);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Invalid repository URL.");
        }

        [Fact]
        public void Validate_MissingRequiredFields_ReportsEach()
        {
            var validator = new BuildRequestValidator();

            var result = validator.Validate(new BuildRequest());

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Branch is required.");
            result.Errors.Should().Contain(e => e.ErrorMessage == "Region ID is required.");
            result.Errors.Should().Contain(e => e.ErrorMessage == "Machine Config ID is required.");
        }

        [Fact]
        public void Validate_InvalidDeploymentUrl_Fails()
        {
            var validator = new BuildRequestValidator();
            var req = ValidRequest();
            req.deploymentUrl = "bad url";

            var result = validator.Validate(req);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Invalid deployment URL.");
        }
    }

    public class RepoDomainUpdateValidatorTests
    {
        private static IConfiguration ConfigWithBlocked(params string[] blocked)
        {
            var dict = new Dictionary<string, string>();
            for (var i = 0; i < blocked.Length; i++)
            {
                dict[$"BlockedCustomDeploymentDomain:{i}"] = blocked[i];
            }
            return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        }

        [Fact]
        public async Task Validate_ValidDomains_Passes()
        {
            var repo = new Mock<IRepoRepository>();
            repo.Setup(r => r.GetRepoCustomDomainExists(It.IsAny<List<RepoWithDomain>>()))
                .ReturnsAsync(true);
            var validator = new RepoDomainUpdateValidator(repo.Object, ConfigWithBlocked("blocked.com"));

            var request = new RepoDomainUpdateRequest
            {
                repoWithDomains = new List<RepoWithDomain>
                {
                    new() { RepoId = "1", CustomDeploymentDomain = "good.example.com" }
                }
            };

            var result = await validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyDomainList_Fails()
        {
            var repo = new Mock<IRepoRepository>();
            repo.Setup(r => r.GetRepoCustomDomainExists(It.IsAny<List<RepoWithDomain>>()))
                .ReturnsAsync(true);
            var validator = new RepoDomainUpdateValidator(repo.Object, ConfigWithBlocked());

            var request = new RepoDomainUpdateRequest { repoWithDomains = new List<RepoWithDomain>() };

            var result = await validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Repo domain list is required.");
        }

        [Fact]
        public async Task Validate_DuplicateDomains_Fails()
        {
            var repo = new Mock<IRepoRepository>();
            repo.Setup(r => r.GetRepoCustomDomainExists(It.IsAny<List<RepoWithDomain>>()))
                .ReturnsAsync(false);
            var validator = new RepoDomainUpdateValidator(repo.Object, ConfigWithBlocked());

            var request = new RepoDomainUpdateRequest
            {
                repoWithDomains = new List<RepoWithDomain>
                {
                    new() { RepoId = "1", CustomDeploymentDomain = "dup.example.com" }
                }
            };

            var result = await validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Duplicate domain names are not allowed.");
        }

        [Fact]
        public async Task Validate_BlockedDomain_Fails()
        {
            var repo = new Mock<IRepoRepository>();
            repo.Setup(r => r.GetRepoCustomDomainExists(It.IsAny<List<RepoWithDomain>>()))
                .ReturnsAsync(true);
            var validator = new RepoDomainUpdateValidator(repo.Object, ConfigWithBlocked("blocked.com"));

            var request = new RepoDomainUpdateRequest
            {
                repoWithDomains = new List<RepoWithDomain>
                {
                    new() { RepoId = "1", CustomDeploymentDomain = "app.blocked.com" }
                }
            };

            var result = await validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage == "Custom deployment domain contains a blocked domain.");
        }
    }
}
