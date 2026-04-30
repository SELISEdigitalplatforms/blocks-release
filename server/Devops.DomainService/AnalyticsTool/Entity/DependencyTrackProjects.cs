using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Blocks.Genesis;

namespace Devops.DomainService.TestingTools.Entity
{
    public class DependencyTrackProjects : BaseEntity
    {
        public string ProjectName { get; set; }
        public string ProjectId { get; set; }
        public string ProjectTeamName { get; set; }
        public string ProjectTeamUuid { get; set; }
        public List<RepoProject> RepoProjects { get; set; }
    }

    public class RepoProject
    {
        public string RepoId { get; set; }
        public string ProjectUuid { get; set; }
    }
}
