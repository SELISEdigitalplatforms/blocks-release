using System;
using System.Collections.Generic;
using Devops.DomainService.AnalyticsTool.Models;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Models.Response;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.TestingTools.Models;
using FluentAssertions;
using ScaVersion = Devops.DomainService.TestingTools.Models.Version;

namespace XUnitTest.Devops.Models
{
    public class DataModelsTests
    {
        [Fact]
        public void Metrics_RoundTripsAllCounters()
        {
            var m = new Metrics
            {
                critical = 1,
                high = 2,
                medium = 3,
                low = 4,
                unassigned = 5,
                vulnerabilities = 6,
                vulnerableComponents = 7,
                components = 8,
                suppressed = 9,
                findingsTotal = 10,
                findingsAudited = 11,
                findingsUnaudited = 12,
                inheritedRiskScore = 13.5,
                policyViolationsFail = 14,
                policyViolationsWarn = 15,
                policyViolationsInfo = 16,
                policyViolationsTotal = 17,
                policyViolationsAudited = 18,
                policyViolationsUnaudited = 19,
                policyViolationsSecurityTotal = 20,
                policyViolationsSecurityAudited = 21,
                policyViolationsSecurityUnaudited = 22,
                policyViolationsLicenseTotal = 23,
                policyViolationsLicenseAudited = 24,
                policyViolationsLicenseUnaudited = 25,
                policyViolationsOperationalTotal = 26,
                policyViolationsOperationalAudited = 27,
                policyViolationsOperationalUnaudited = 28,
                collectionLogic = "aggregate",
                collectionLogicChanged = true,
                firstOccurrence = "first",
                lastOccurrence = "last"
            };

            m.critical.Should().Be(1);
            m.high.Should().Be(2);
            m.medium.Should().Be(3);
            m.low.Should().Be(4);
            m.unassigned.Should().Be(5);
            m.vulnerabilities.Should().Be(6);
            m.vulnerableComponents.Should().Be(7);
            m.components.Should().Be(8);
            m.suppressed.Should().Be(9);
            m.findingsTotal.Should().Be(10);
            m.inheritedRiskScore.Should().Be(13.5);
            m.policyViolationsTotal.Should().Be(17);
            m.policyViolationsSecurityTotal.Should().Be(20);
            m.policyViolationsLicenseTotal.Should().Be(23);
            m.policyViolationsOperationalTotal.Should().Be(26);
            m.collectionLogic.Should().Be("aggregate");
            m.collectionLogicChanged.Should().BeTrue();
            m.firstOccurrence.Should().Be("first");
            m.lastOccurrence.Should().Be("last");
        }

        [Fact]
        public void User_DefaultsAndRoundTrip()
        {
            var user = new User();

            user.Memberships.Should().NotBeNull().And.BeEmpty();
            user.VarifiedType.Should().Be(UserVarifiedType.None);
            user.UserCreationType.Should().Be(UserCreationType.None);
            user.UserPassType.Should().Be(UserPassType.None);
            user.UserMfaType.Should().Be(UserMfaType.None);
            user.AllowedLogInType.Should().NotBeNull().And.BeEmpty();
            user.LastLoggedInDeviceInfo.Should().Be(string.Empty);

            user.FirstName = "Jane";
            user.LastName = "Doe";
            user.Email = "jane@example.com";
            user.UserName = "jane";
            user.Active = true;
            user.MfaEnabled = true;
            user.LogInCount = 3;
            user.VarifiedType = UserVarifiedType.Email;
            user.UserCreationType = UserCreationType.Portal;

            user.FirstName.Should().Be("Jane");
            user.Email.Should().Be("jane@example.com");
            user.Active.Should().BeTrue();
            user.MfaEnabled.Should().BeTrue();
            user.LogInCount.Should().Be(3);
            user.VarifiedType.Should().Be(UserVarifiedType.Email);
            user.UserCreationType.Should().Be(UserCreationType.Portal);
        }

        [Fact]
        public void Build_HasExpectedDefaultsAndRoundTrips()
        {
            var build = new Build();

            build.Status.Should().Be(EventStatus.STARTED);
            build.EventName.Should().Be(EventNames.PIPELINE);

            build.ProjectId = "p1";
            build.ProjectName = "proj";
            build.RepoName = "repo";
            build.RepoUrl = "https://github.com/o/r";
            build.Branch = "main";
            build.Commit = "abc123";
            build.Duration = 500;
            build.Status = EventStatus.SUCCEEDED;
            build.Events = new List<BuildEventResponse>();

            build.ProjectId.Should().Be("p1");
            build.Branch.Should().Be("main");
            build.Commit.Should().Be("abc123");
            build.Duration.Should().Be(500);
            build.Status.Should().Be(EventStatus.SUCCEEDED);
            build.Events.Should().BeEmpty();
        }

        [Fact]
        public void Repo_WithNestedWebhookAndConfig_RoundTrips()
        {
            var repo = new Repo
            {
                SourceRepoId = "src1",
                ProjectId = "p1",
                RepoName = "repo",
                RepoUrl = "https://github.com/o/r",
                Branch = "dev",
                DeploymentType = "Auto",
                LastDeploymentDate = new DateTime(2024, 1, 1),
                LastDeploymentStatus = "Succeeded",
                GithubWebhook = new GithubWebhook
                {
                    Id = 42,
                    Name = "web",
                    Active = true,
                    Events = new List<string> { "push" },
                    Config = new Config { ContentType = "json", InsecureSsl = "0", Url = "https://hook" }
                }
            };

            repo.SourceRepoId.Should().Be("src1");
            repo.Branch.Should().Be("dev");
            repo.LastDeploymentDate.Should().Be(new DateTime(2024, 1, 1));
            repo.GithubWebhook.Id.Should().Be(42);
            repo.GithubWebhook.Active.Should().BeTrue();
            repo.GithubWebhook.Events.Should().Contain("push");
            repo.GithubWebhook.Config.Url.Should().Be("https://hook");
        }

        [Fact]
        public void RepositoryWebhook_RoundTrips()
        {
            var hook = new RepositoryWebhook
            {
                RepoId = "r1",
                RepoUrl = "https://github.com/o/r",
                Ref = "refs/heads/main",
                BeforeSha = "aaa",
                AfterSha = "bbb",
                HeadCommitSha = "ccc",
                HeadCommitMessage = "fix",
                PusherName = "dev",
                PusherEmail = "dev@example.com",
                HeadCommitTimestamp = new DateTime(2024, 5, 5),
                AuthorName = "author",
                CommitterEmail = "c@example.com"
            };

            hook.RepoId.Should().Be("r1");
            hook.Ref.Should().Be("refs/heads/main");
            hook.AfterSha.Should().Be("bbb");
            hook.HeadCommitMessage.Should().Be("fix");
            hook.HeadCommitTimestamp.Should().Be(new DateTime(2024, 5, 5));
            hook.CommitterEmail.Should().Be("c@example.com");
        }

        [Fact]
        public void SCAResultResponse_WithNestedTypes_RoundTrips()
        {
            var response = new SCAResultResponse
            {
                name = "pkg",
                version = "1.0.0",
                purl = "pkg:npm/pkg@1.0.0",
                uuid = "u1",
                active = true,
                isLatest = false,
                lastInheritedRiskScore = 9.9,
                metadata = new Metadata { authors = new List<Author> { new() } },
                versions = new List<ScaVersion> { new() { uuid = "v1", version = "1.0.0", active = true } },
                metrics = new Metrics { critical = 2 }
            };

            response.name.Should().Be("pkg");
            response.active.Should().BeTrue();
            response.lastInheritedRiskScore.Should().Be(9.9);
            response.versions.Should().ContainSingle();
            response.versions[0].version.Should().Be("1.0.0");
            response.metrics.critical.Should().Be(2);
        }

        [Fact]
        public void SCAVulnerability_WithComponentAndVulnerability_RoundTrips()
        {
            var sca = new SCAVulnerability
            {
                component = new MyComponent { uuid = "c1", name = "comp", version = "1.0", group = "g" },
                vulnerability = new Vulnerability
                {
                    uuid = "v1",
                    source = "NVD",
                    vulnId = "CVE-1",
                    severity = "HIGH",
                    severityRank = 1,
                    epssScore = 0.5,
                    cvssV3BaseScore = 7.5,
                    cweId = 79,
                    cweName = "XSS",
                    aliases = new List<Alias> { new() { cveId = "CVE-1" } },
                    cwes = new List<Cwe> { new() { cweId = 79, name = "XSS" } }
                },
                analysis = new Analysis { isSuppressed = true },
                attribution = new Attribution { analyzerIdentity = "INTERNAL" },
                matrix = "m"
            };

            sca.component.name.Should().Be("comp");
            sca.vulnerability.vulnId.Should().Be("CVE-1");
            sca.vulnerability.severityRank.Should().Be(1);
            sca.vulnerability.cvssV3BaseScore.Should().Be(7.5);
            sca.vulnerability.aliases.Should().ContainSingle();
            sca.vulnerability.cwes[0].name.Should().Be("XSS");
            sca.analysis.isSuppressed.Should().BeTrue();
            sca.attribution.analyzerIdentity.Should().Be("INTERNAL");
        }

        [Fact]
        public void VulnerabilityResponse_RoundTrips()
        {
            var v = new VulnerabilityResponse
            {
                Name = "comp",
                Version = "1.0",
                LatestVersion = "2.0",
                Id = "CVE-9",
                Score = "7.5",
                Severity = "HIGH",
                Group = "g",
                EpssPercentile = 0.9,
                EpssScore = 0.5,
                Description = "desc",
                CweName = "XSS",
                Aliases = new List<Alias> { new() { cveId = "CVE-9" } }
            };

            v.Name.Should().Be("comp");
            v.LatestVersion.Should().Be("2.0");
            v.Severity.Should().Be("HIGH");
            v.EpssPercentile.Should().Be(0.9);
            v.Aliases.Should().ContainSingle();
        }

        [Fact]
        public void ScaLookupResponse_RoundTrips()
        {
            var r = new ScaLookupResponse
            {
                name = "pkg",
                uuid = "u1",
                metrics = new Metrics { high = 5 },
                versions = new List<VersionInfo> { new() { uuid = "v", version = "1.0", active = true } }
            };

            r.name.Should().Be("pkg");
            r.metrics.high.Should().Be(5);
            r.versions[0].active.Should().BeTrue();
        }

        [Fact]
        public void SonarQubeUserResponse_RoundTrips()
        {
            var u = new SonarQubeUserResponse
            {
                id = "id",
                login = "login",
                name = "name",
                email = "e@example.com",
                active = true,
                local = false,
                externalLogin = "ext",
                externalProvider = "github"
            };

            u.login.Should().Be("login");
            u.email.Should().Be("e@example.com");
            u.active.Should().BeTrue();
            u.externalProvider.Should().Be("github");
        }
    }
}
