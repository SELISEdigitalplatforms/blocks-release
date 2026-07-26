using Devops.DomainService.DataGetwayDeployment.Models;
using FluentAssertions;

namespace XUnitTest.Devops.DataGatewayDeployment
{
    public class EnvironmentMapperHelperTests
    {
        [Theory]
        [InlineData("dev", "d")]
        [InlineData("test", "t")]
        [InlineData("stg", "s")]
        [InlineData("iat", "i")]
        [InlineData("uat", "u")]
        [InlineData("prod-shadow", "h")]
        [InlineData("pre-prod", "r")]
        [InlineData("prod", "p")]
        [InlineData("something-else", "n")]
        public void EnvironmentMapper_MapsEnvironmentToCode(string env, string expected)
        {
            EnvironmentMapperHelper.EnvironmentMapper(env).Should().Be(expected);
        }

        [Fact]
        public void BlocksGuid_PropertiesRoundTrip()
        {
            var guid = new BlocksGuid
            {
                ItemId = "id1",
                TenantGroupId = "tg1",
                OriginalValue = "orig",
                EncodedValue = "enc"
            };

            guid.ItemId.Should().Be("id1");
            guid.TenantGroupId.Should().Be("tg1");
            guid.OriginalValue.Should().Be("orig");
            guid.EncodedValue.Should().Be("enc");
        }
    }
}
