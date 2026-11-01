using Blocks.Genesis.Entities.Release;
using Devops.DomainService.Deployment.RepositoryServices;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Xunit;

namespace XUnitTest.Devops.Deployment
{
    /// <summary>#255 H15: how the build reads drop the saved reports from whatever projection the resolver built.</summary>
    public class BuildRepositoryReportProjectionTests
    {
        private static BsonDocument Render(ProjectionDefinition<Build> projection) =>
            projection.Render(new RenderArgs<Build>(BsonSerializer.SerializerRegistry.GetSerializer<Build>(), BsonSerializer.SerializerRegistry));

        [Fact]
        public void NoProjection_ExcludesBothReports()
        {
            Render(BuildRepository.WithoutReports(null)).Should().Equal(new BsonDocument { { "SastReport", 0 }, { "ScaReport", 0 } });
        }

        [Fact]
        public void ExclusionProjection_KeepsItsExclusionsAndAddsTheReports()
        {
            var resolver = new BsonDocument { { "Events", 0 }, { "ImageName", 0 } };

            var rendered = Render(BuildRepository.WithoutReports(new BsonDocumentProjectionDefinition<Build>(resolver)));

            rendered.Should().Equal(new BsonDocument { { "Events", 0 }, { "ImageName", 0 }, { "SastReport", 0 }, { "ScaReport", 0 } });
            resolver.Should().Equal(new BsonDocument { { "Events", 0 }, { "ImageName", 0 } }, "the resolver's projection is not mutated");
        }

        [Fact]
        public void ExclusionProjection_ThatOnlyDropsTheId_IsAnExclusion()
        {
            var rendered = Render(BuildRepository.WithoutReports(new BsonDocumentProjectionDefinition<Build>(new BsonDocument("_id", 0))));

            rendered.Should().Equal(new BsonDocument { { "_id", 0 }, { "SastReport", 0 }, { "ScaReport", 0 } });
        }

        [Fact]
        public void InclusionProjection_DropsOnlyTheListedReportPaths()
        {
            var resolver = new BsonDocument
            {
                { "_id", 0 }, { "RepoName", 1 }, { "Branch", true }, { "SastReport", 1 }, { "SastReport.Status", 1 },
                { "ScaReport.Findings", 1 }, { "SastReportExtra", 1 },
            };

            var rendered = Render(BuildRepository.WithoutReports(new BsonDocumentProjectionDefinition<Build>(resolver)));

            // No exclusion is added: MongoDB rejects mixing, and an inclusion leaves unlisted fields out anyway.
            rendered.Should().Equal(new BsonDocument { { "_id", 0 }, { "RepoName", 1 }, { "Branch", true }, { "SastReportExtra", 1 } });
            resolver.ElementCount.Should().Be(7, "the resolver's projection is not mutated");
        }

        [Fact]
        public void InclusionProjection_WithoutReports_IsUnchanged()
        {
            var resolver = new BsonDocument { { "RepoName", 1.0 } };

            Render(BuildRepository.WithoutReports(new BsonDocumentProjectionDefinition<Build>(resolver))).Should().Equal(resolver);
        }

        [Theory]
        [InlineData(0, false)]
        [InlineData(0L, false)]
        [InlineData(0.0, false)]
        [InlineData(-0.0, false)]
        [InlineData(false, false)]
        [InlineData(1, true)]
        [InlineData(2L, true)]
        [InlineData(-1.0, true)]
        [InlineData(0.5, true)]
        [InlineData(double.Epsilon, true)]
        [InlineData(double.NaN, true)]
        [InlineData(true, true)]
        public void ProjectionValue_IncludesItsFieldOnlyWhenTrueOrNonZero(object value, bool inclusion)
        {
            var resolver = new BsonDocument { { "RepoName", BsonValue.Create(value) } };

            var rendered = Render(BuildRepository.WithoutReports(new BsonDocumentProjectionDefinition<Build>(resolver)));

            // Names only: NaN never equals itself, so the documents cannot be compared value by value.
            if (inclusion)
                rendered.Names.Should().Equal("RepoName");
            else
                rendered.Names.Should().Equal("RepoName", "SastReport", "ScaReport");
        }

        [Fact]
        public void UnknownProjectionShape_IsKeptAsTheResolverBuiltIt()
        {
            var resolver = Builders<Build>.Projection.Include(b => b.RepoName);

            BuildRepository.WithoutReports(resolver).Should().BeSameAs(resolver);
        }
    }
}
