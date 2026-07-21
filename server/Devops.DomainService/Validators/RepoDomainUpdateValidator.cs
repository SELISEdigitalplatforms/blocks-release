using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using FluentValidation;
using Microsoft.Extensions.Configuration;

namespace Devops.DomainService.Validators
{
     public class RepoDomainUpdateValidator : AbstractValidator<RepoDomainUpdateRequest>
    {
        private readonly IRepoRepository _repoRepository;
        private readonly IConfiguration _configuration;
        public RepoDomainUpdateValidator(IRepoRepository repoRepository, IConfiguration configuration)
        {
            _repoRepository = repoRepository;
            _configuration = configuration;

            RuleFor(x => x.repoWithDomains)
                .NotEmpty().WithMessage("Repo domain list is required.")
                .MustAsync(NoDuplicateDomainsAsync)
                .WithMessage("Duplicate domain names are not allowed.")
                .Must(NotContainBlockedDomains)
                .WithMessage("Custom deployment domain contains a blocked domain.");
        }

        private async Task<bool> NoDuplicateDomainsAsync(List<RepoWithDomain> list, CancellationToken cancellationToken)
        {
            return await _repoRepository.GetRepoCustomDomainExists(list);
        }

        private bool NotContainBlockedDomains(List<RepoWithDomain> list)
        {
            if (list == null)
            {
                return true;
            }

            var blockedDomains = _configuration.GetSection("BlockedCustomDeploymentDomain").Get<string[]>() ?? Array.Empty<string>();

            return !list.Any(r => !string.IsNullOrEmpty(r.CustomDeploymentDomain)
                && blockedDomains.Any(b => r.CustomDeploymentDomain.Contains(b, StringComparison.OrdinalIgnoreCase)));
        }
    }
}
