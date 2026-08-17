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
        /// Base64-encoded kubeconfig, seeded only in the dev and stg vaults. Its presence is what
        /// selects the vaulted cluster credential; production leaves it unset and keeps using the
        /// in-cluster service account.
        /// </summary>
        public string KubeConfig { get; set; }

        /// <summary>
        /// Base64-encoded (or plain) Tekton PipelineRun definition for the FE construct build.
        /// Seeded in every vault - each environment maintains its own document.
        /// </summary>
        public string PipelineRunFeConstruct { get; set; }
    }
}
