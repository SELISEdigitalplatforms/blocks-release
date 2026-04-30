using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using FluentValidation;

namespace Devops.DomainService.Validators
{
    public class RepoDomainUpdateValidator : AbstractValidator<RepoDomainUpdateRequest>
    {
        private readonly IRepoRepository _repoRepository;
        public RepoDomainUpdateValidator(IRepoRepository repoRepository)
        {
            _repoRepository = repoRepository;

            RuleFor(x => x.repoWithDomains)
                .NotEmpty().WithMessage("Repo domain list is required.")
                .MustAsync(NoDuplicateDomainsAsync)
                .WithMessage("Duplicate domain names are not allowed.");
        }

        private async Task<bool> NoDuplicateDomainsAsync(List<RepoWithDomain> list, CancellationToken cancellationToken)
        {
            return await _repoRepository.GetRepoCustomDomainExists(list);
        }
    }
}
