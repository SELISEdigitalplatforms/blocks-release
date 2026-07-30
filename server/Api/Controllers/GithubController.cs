using System.Net;
using System.Security.Cryptography;
using System.Text;
using Blocks.Genesis;
using Devops.DomainService.Deployment.Entities;
using Devops.DomainService.Deployment.Interfaces;
using Devops.DomainService.Deployment.Models.Request;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.VersionControlSystems.Models.Request;
using Devops.DomainService.VersionControlSystems.Services;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class GithubController: ControllerBase
{
    private readonly ILogger<GithubController> _logger;
    private readonly IVersionControlService _githubService;
    private readonly IRepoRepository _repoRepository;
    private readonly IGithubWebhookService _webhoookService;
    private readonly IBuildService _buildService;
    private readonly IConfiguration _config;
    private readonly string _secret; 
    public GithubController(IConfiguration config,
                            ILogger<GithubController> logger, 
                            IVersionControlService githubService,
                            IGithubWebhookService webhoookService, 
                            IRepoRepository repoRepository, 
                            IBuildService buildService, 
                            ICloudBuildSecret cloudBuildSecret)
    {
        _logger = logger;
        _githubService = githubService;
        _webhoookService = webhoookService;
        _config = config;
        _buildService = buildService;
        _repoRepository = repoRepository;
        _secret = cloudBuildSecret.GithubWebhookSecret;
    }

    [HttpGet("user")]
    [ProtectedEndPoint("blocks-release::github::user")]
    public async Task<ActionResult> GetUser()
    {
        var user = await _githubService.GetUser();
        if(user!=null)
            return Ok(user);
        return BadRequest("User not found");
    }

    [HttpGet("repos")]
    [ProtectedEndPoint("blocks-release::github::repos")]
    public async Task<ActionResult> GetRepos([FromQuery] string? Search, [FromQuery] int PageNumber = 1, [FromQuery] int PageSize = 30)
    {

        SearchRepositoryListRequest request = new SearchRepositoryListRequest()
        {
            Search = Search,
            PageNumber = PageNumber,
            PageSize = PageSize
        };

        var result = await _githubService.SearchUserRepositories(request);
        if (result.StatusCode == HttpStatusCode.OK)
        {
            return Ok(result);
        }
        return BadRequest(result);
    }
    
    [HttpGet("branches")]
    [ProtectedEndPoint("blocks-release::github::branches")]
    public async Task<ActionResult> GetBranches([FromQuery] string repo)
    {
        var branches = await _githubService.GetBranches(repo);
        if(branches!=null)
            return Ok(branches);
        return BadRequest("failed to get branches");
    }

    [HttpGet("GithubBranchExists")]
    [ProtectedEndPoint("blocks-release::github::branch-exists")]
    public async Task<ActionResult> GithubBranchExists([FromQuery] string repoId)
    {
        Repo repo = await _repoRepository.GetRepo(repoId);
        if (repo is null)
        {
            return Ok(
            new BaseApiResponse()
            {
                Message = "Repository not found.",
                IsSuccess = false,
                StatusCode = HttpStatusCode.BadRequest
            });
        }
        var (result, errorMessage) = await _githubService.GetRepoBranchByName(repo.RepoName, repo.Branch);
        return Ok(
            new BaseApiResponse()
            {
                IsSuccess = result,
                Message = errorMessage,
                StatusCode = HttpStatusCode.OK
            });
    }

    [HttpGet("clone")]
    [ProtectedEndPoint("blocks-release::github::clone")]
    public async Task<ActionResult> Clone([FromQuery] string repo)
    {
        var result = await _githubService.Clone(repo);
        if (result)
            return Ok("Successfully cloned repo");
        return BadRequest("Failed to clone repo");
    }

    [HttpPost("webhook")]
    public async Task<ActionResult> Webhook([FromQuery(Name = "x-blocks-key")] string tenantId)
    {
        //https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries
        HttpContext.Request.EnableBuffering();
        var body = await new StreamReader(HttpContext.Request.Body, leaveOpen: true).ReadToEndAsync();
        HttpContext.Request.Body.Position = 0;          // rewind for any later readers

        // 1️⃣  Validate signature ---------------------------------------------------
        var theirSig = HttpContext.Request.Headers["X-Hub-Signature-256"].ToString();
        if (string.IsNullOrWhiteSpace(theirSig))
            return BadRequest("Missing X‑Hub‑Signature‑256 header");

        var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secret));
        var hash  = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        var oursSig = "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();


        // 2️⃣  Work out which event this is ----------------------------------------
        var eventType = HttpContext.Request.Headers["X-GitHub-Event"].ToString();

        // Always acknowledge *quickly*
        // (GitHub considers any non‑2xx within 10 s a failure)
        // JS sample returns 202; we’ll do the same
        // _ = Task.Run(() => HandleEventAsync(eventType, body, logger));
        var result = await _buildService.HandleWebhookEventAsync(eventType,body, tenantId);
        return Ok(result);
    }

    [HttpGet("CreateWebhook")]
    [ProtectedEndPoint("blocks-release::github::create-webhook")]
    public async Task<ActionResult> CreateWebhook([FromQuery] string RepoId)
    {
        var repo = await _repoRepository.GetRepo(RepoId);
        if (repo is null)
        {
            return BadRequest(new BaseApiResponse()
            {
                Message = "Repository not found.",
                IsSuccess = false
            });
        }
        var result = await _webhoookService.CreateWebhook(repo);
        if (result is not null)
        {
            return Ok(new BaseApiResponse()
            {
                IsSuccess = true,
                Message = "Successfully created webhook."
            }); ;
        }
        return BadRequest(new BaseApiResponse()
        {
            Message = "Failed to create webhook",
            IsSuccess = false
        });
    }
}

