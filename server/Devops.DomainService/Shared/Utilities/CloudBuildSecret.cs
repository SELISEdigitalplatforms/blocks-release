using Devops.DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using System.Reflection;

namespace Blocks.Genesis
{
    public sealed class CloudBuildSecret : ICloudBuildSecret
    {
        public string SeliseGithubPat { get; set; }
        public string ServiceName { get; set; }
        public string SastBasicAuthToken { get; set; }
        public string DependencyTrackApiKey { get; set; }
        public string DependencyTrackDefaultTeamId { get; set; }
        public string GithubWebhookSecret { get; set; }
        public string GithubClientSecret { get; set; }
        public string GithubClientId { get; set; }
        public string SonarQubeToken { get; set; }

        // Both are looked up in the vault by property name (see the reflection loop below), so the
        // Key Vault secret names are exactly "KubeConfig" and "PipelineRunFeConstruct". A secret that
        // does not exist is swallowed by the vault client and simply leaves the property null.
        //
        // Nothing reads either one at the moment - the kubeconfig and the FE construct PipelineRun
        // are temporarily back on the machine and the checked-in asset. The properties stay so the
        // vault secrets keep being carried through and the switch back stays a small change; see
        // ICloudBuildSecret for where each one plugs in.
        public string KubeConfig { get; set; }
        public string PipelineRunFeConstruct { get; set; }


        public static async Task<ICloudBuildSecret> ProcessBlocksSecret(VaultType vaultType = VaultType.Azure)
        {
            IVault cloudVault = Vault.GetCloudVault(vaultType);
            var blocksSecret = new CloudBuildSecret();
            PropertyInfo[] properties = typeof(CloudBuildSecret).GetProperties();
            var blocksSecretVault = await cloudVault.ProcessSecretsAsync(properties.Select(x => x.Name).ToList());

            foreach (PropertyInfo property in properties)
            {
                string propertyName = property.Name;
                var isExist = blocksSecretVault.TryGetValue(propertyName, out var retrievedValue);

                if (isExist && !string.IsNullOrWhiteSpace(retrievedValue))
                {
                    object convertedValue = ConvertValue(retrievedValue, property.PropertyType);

                    UpdateProperty(blocksSecret, propertyName, convertedValue);
                }
            }

            return blocksSecret;
        }



        public static void UpdateProperty<T>(T blocksSecret, string propertyName, object propertyValue) where T : class
        {
            var property = blocksSecret.GetType().GetProperty(propertyName);

            if (property != null && property.CanWrite)
            {
                property.SetValue(blocksSecret, propertyValue);
            }
            else
            {
                Console.WriteLine($"Property '{propertyName}' not found or is read-only.");
            }
        }

        public static object ConvertValue(string value, Type targetType)
        {
            if (targetType != typeof(string))
            {
                try
                {
                    return Convert.ChangeType(value, targetType);
                }
                catch (Exception e)
                {
                    Console.WriteLine(e.Message);
                }
            }
            return value;
        }
    }
}
