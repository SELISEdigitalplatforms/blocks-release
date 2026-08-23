using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Devops.DomainService.Shared.Entities
{
    public interface ICloudBuildSecret
    {
        public string ServiceName { get; set; }
        public string SeliseGithubPat { get; set; }
        public string SastBasicAuthToken { get; set; }
        public string DependencyTrackApiKey { get; set; }
        public string DependencyTrackDefaultTeamId { get; set; }
        public string SonarQubeToken { get; set; }
        public string GithubWebhookSecret { get; set; }
        public string GithubClientSecret { get; set; }
        public string GithubClientId { get; set; }

        /// <summary>
        /// Base64-encoded kubeconfig, seeded in the dev and stg vaults.
        /// <para>
        /// NOT READ RIGHT NOW. The Kubernetes client is temporarily back on the machine credential
        /// (local kubeconfig in Development, otherwise the in-cluster service account) - see
        /// ServiceRegistry. The vault side is left in place, along with KubernetesClientResolver,
        /// so switching back is a one-line change in that registration.
        /// </para>
        /// </summary>
        public string KubeConfig { get; set; }

        /// <summary>
        /// Base64-encoded (or plain) Tekton PipelineRun definition for the FE construct build.
        /// <para>
        /// NOT READ RIGHT NOW. The FE construct is temporarily back on the checked-in asset,
        /// Assets/pipeline_fe_react_construct.yaml via CloudBuildConstants.YAML_PATH. To switch
        /// back, feed this secret through VaultSecret.DecodeText into PipelineRunSettings.fromYaml.
        /// </para>
        /// </summary>
        public string PipelineRunFeConstruct { get; set; }
    }
}
