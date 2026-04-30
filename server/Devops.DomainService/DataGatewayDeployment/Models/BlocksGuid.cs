using MongoDB.Bson.Serialization.Attributes;

namespace Devops.DomainService.DataGetwayDeployment.Models
{
    [BsonIgnoreExtraElements]
    public class BlocksGuid
    {
        [BsonId]
        public string ItemId { get; set; }
        public string TenantGroupId { get; set; }
        public string OriginalValue { get; set; }
        public string EncodedValue { get; set; }
    }

    public static class EnvironmentMapperHelper
    {
        public static string EnvironmentMapper(string env) =>
            env switch
            {
                "dev" => "d",
                "test" => "t",
                "stg" => "s",
                "iat" => "i",
                "uat" => "u",
                "prod-shadow" => "h",
                "pre-prod" => "r",
                "prod" => "p",
                _ => "n"
            };
    }
}
