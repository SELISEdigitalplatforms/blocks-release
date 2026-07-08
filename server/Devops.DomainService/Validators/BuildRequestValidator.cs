using Devops.DomainService.Deployment.Models.Request;
using FluentValidation;

namespace Devops.DomainService.Validators
{
    public class BuildRequestValidator : AbstractValidator<BuildRequest>
    {
        public BuildRequestValidator()
        {
            RuleFor(x => x.repoUrl)
                .NotEmpty().WithMessage("Repository URL is required.")
                .Must(uri => Uri.IsWellFormedUriString(uri, UriKind.Absolute))
                .WithMessage("Invalid repository URL.");

            RuleFor(x => x.repoName)
                .NotEmpty().WithMessage("Repo Name is required.");

            RuleFor(x => x.branch)
                .NotEmpty().WithMessage("Branch is required.");

            RuleFor(x => x.projectName)
                .NotEmpty().WithMessage("Project Nme is required.");

            RuleFor(x => x.deploymentUrl)
                .NotEmpty().WithMessage("Deployment URL is required.")
                .Must(uri => Uri.IsWellFormedUriString(uri, UriKind.Absolute))
                .WithMessage("Invalid deployment URL.");

            RuleFor(x => x.hostingProviderId)
                .NotEmpty().WithMessage("Hosting Provider ID is required.");

            RuleFor(x => x.regionId)
                .NotEmpty().WithMessage("Region ID is required.");

            RuleFor(x => x.machineConfigId)
                .NotEmpty().WithMessage("Machine Config ID is required.");

            RuleFor(x => x.deploymentType)
                .NotEmpty().WithMessage("Deployment Type is required.");
                //.Must(type => new[] { "Approval", "Auto", "Manual" }.Contains(type.ToLower()))
                //.WithMessage("Deployment Type must be either 'docker', 'kubernetes', or 'serverless'.");
        }
    }
}
