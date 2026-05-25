using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Blocks.Genesis;

namespace Devops.DomainService.VersionControlSystems.Models.Request
{
    public class SearchRepositoryListRequest : IProjectKey
    {
        public string ProjectKey { get; set; }
        public string Search { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }
}
