using System.Text;

using Devops.DomainService.Shared.Entities;

using k8s;

namespace Devops.DomainService.Shared.Utilities
{
    /// <summary>
    /// Decides which credential the Kubernetes client is built from.
    /// <para>
    /// The switch between the vaulted kubeconfig and the in-cluster service account is the
    /// <em>presence</em> of the "KubeConfig" secret in that environment's vault, not the environment
    /// name. Dev and stg seed the secret; production deliberately does not, and so keeps using its
    /// in-cluster service account exactly as before. Name-based gating would not work here: the
    /// worker image hardcodes DOTNET_ENVIRONMENT=Production in every environment, so the dev and stg
    /// workers would disagree with their own APIs.
    /// </para>
    /// <para>
    /// When nothing resolves the client is left null, which is the pre-existing contract - startup
    /// still succeeds and callers already guard against an unavailable cluster.
    /// </para>
    /// </summary>
    public static class KubernetesClientResolver
    {
        public static IKubernetes Resolve(ICloudBuildSecret secret, bool isDevelopment) =>
            Resolve(secret, isDevelopment, FromVaultedKubeConfig, FromInCluster, FromLocalKubeConfigFile);

        /// <summary>
        /// Seam-injected overload. The three delegates are the only places that touch the machine or
        /// the cluster, so tests can drive every branch of the resolution order without a kubeconfig
        /// on disk, a pod, or an environment variable.
        /// </summary>
        public static IKubernetes Resolve(
            ICloudBuildSecret secret,
            bool isDevelopment,
            Func<string, IKubernetes> fromVault,
            Func<IKubernetes> fromInCluster,
            Func<IKubernetes> fromLocalFile)
        {
            var localFileAlreadyTried = false;

            // A developer's own kubeconfig wins on a laptop, ahead of whatever the OnPrem vault holds.
            if (isDevelopment)
            {
                localFileAlreadyTried = true;
                if (TryResolve(fromLocalFile, "local kubeconfig", out var developerClient))
                    return developerClient;
            }

            var vaultedKubeConfig = secret?.KubeConfig;
            if (!string.IsNullOrWhiteSpace(vaultedKubeConfig))
            {
                if (TryResolve(() => fromVault(vaultedKubeConfig), "vaulted KubeConfig", out var vaultClient))
                    return vaultClient;
            }
            else
            {
                Console.WriteLine(
                    "Kubernetes: no KubeConfig secret in the vault. Falling back to the in-cluster service account.");
            }

            if (TryResolve(fromInCluster, "in-cluster service account", out var inClusterClient))
                return inClusterClient;

            if (!localFileAlreadyTried &&
                TryResolve(fromLocalFile, "local kubeconfig", out var localClient))
                return localClient;

            Console.WriteLine(
                "Kubernetes: no cluster credential could be resolved. Kubernetes client is unavailable.");
            return null!;
        }

        private static bool TryResolve(Func<IKubernetes> build, string source, out IKubernetes client)
        {
            try
            {
                client = build();
                return client is not null;
            }
            catch (Exception ex)
            {
                // Every fallback says why it was taken - the previous implementation swallowed these.
                Console.WriteLine($"Kubernetes: {source} is unusable ({ex.GetType().Name}: {ex.Message}).");
                client = null!;
                return false;
            }
        }

        private static IKubernetes FromVaultedKubeConfig(string secretValue)
        {
            var kubeConfigYaml = VaultSecret.DecodeText(secretValue);

            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(kubeConfigYaml));
            var kubeConfig = KubernetesClientConfiguration
                .LoadKubeConfigAsync(stream)
                .GetAwaiter()
                .GetResult();

            return new Kubernetes(KubernetesClientConfiguration.BuildConfigFromConfigObject(kubeConfig));
        }

        private static IKubernetes FromInCluster() =>
            new Kubernetes(KubernetesClientConfiguration.InClusterConfig());

        private static IKubernetes FromLocalKubeConfigFile() =>
            new Kubernetes(KubernetesClientConfiguration.BuildConfigFromConfigFile());
    }
}
