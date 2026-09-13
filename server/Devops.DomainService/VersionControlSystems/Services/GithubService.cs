using System.Text.RegularExpressions;
using Devops.DomainService.Shared.Interfaces;
using Devops.DomainService.Shared.Utilities;
using Devops.DomainService.VersionControlSystems.Models.Dtos;
using Devops.DomainService.VersionControlSystems.Models.Response;
using Devops.DomainService.VersionControlSystems.Interfaces;
using Devops.DomainService.Shared.Models;
using System.Net;
using Devops.DomainService.VersionControlSystems.Models.Request;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Entities;
using Microsoft.Extensions.Configuration;
using System.Text;

namespace Devops.DomainService.VersionControlSystems.Services;

public class GithubService : IVersionControlService
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);
    private readonly ITokenRepository _tokenRepository;
    private readonly IHttpHelperServices _httpHelperServices;
    private readonly IConfiguration _configuration;
    private readonly ICloudBuildSecret _cloudBuildSecret;

    public GithubService(ITokenRepository tokenRepository, IHttpHelperServices httpHelperServices, IConfiguration configuration, ICloudBuildSecret cloudBuildSecret)
    {
        _tokenRepository = tokenRepository;
        _httpHelperServices = httpHelperServices;
        _configuration = configuration;
        _cloudBuildSecret = cloudBuildSecret;
    }

    public async Task<GithubUserResponse> GetUser()
    {
        var token = await _tokenRepository.getToken();
        if (token == null) return null;
        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user";
        var headers = new Dictionary<string, string>
        {
            { "Accept", "application/vnd.github.v3+json" },
            { "User-Agent", "BlocksDevOps"},
            { "Authorization", $"Bearer {token.AccessToken}"},
        };
        var (user, response) = await _httpHelperServices.MakeHttpGetRequest<GithubUserResponse>(url, null, headers);

        if (user is not null)
        {
            return user;
        }
        else
            return null;
    }

    public async Task<GithubUserResponse> GetUser(string accessToken)
    {
        var token = accessToken;
        if (token == null) return null;
        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"},
                { "Authorization", $"Bearer {token}"},
            };
        var (user, response) = await _httpHelperServices.MakeHttpGetRequest<GithubUserResponse>(url, null, headers);

        if (user is not null)
        {
            return user;
        }
        else
            return null;
    }

    public async Task<bool> ValidateAccessToken(RepositoryToken token)
    {
        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user";
        var headers = new Dictionary<string, string>
        {
            { "User-Agent", "BlocksDevOps" },
            { "Authorization", $"Bearer {token.AccessToken}" }
        };

        var (result, response) = await _httpHelperServices.MakeHttpRequest<object>(
            $"{CloudBuildConstants.GITHUB_API_BASE_URI}",
            url,
            HttpMethod.Get,
            null,
            headers,
            null
        );

        return response.IsSuccessStatusCode;

    }


    public async Task<bool> RevokeOauthAccess(RepositoryToken token)
    {
        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/applications/{_cloudBuildSecret.GithubClientId}/token";
        string authString = $"{_cloudBuildSecret.GithubClientId}:{_cloudBuildSecret.GithubClientSecret}";
        string base64Auth = Convert.ToBase64String(Encoding.ASCII.GetBytes(authString));
        var headers = new Dictionary<string, string>
        {
            { "User-Agent", "BlocksDevOps"},
            { "Authorization", $"Basic {base64Auth}"}
        };
        var payload = new
        {
            access_token = token.AccessToken
        };

        var (result, response) = await _httpHelperServices.MakeHttpDeleteRequest<Object>(CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Delete, payload, headers, null);

        if (response.IsSuccessStatusCode)
        {
            return true;
        }
        return false;

    }

    public async Task<List<GithubUserOrgResponse>> GetUserOrganizations(string accessToken)
    {
        var token = accessToken;
        if (token == null) return null;

        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user/orgs";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"},
                { "Authorization", $"Bearer {token}"},
            };
        var (orgList, response) = await _httpHelperServices.MakeHttpGetRequest<List<GithubUserOrgResponse>>(url, null, headers);

        if (orgList is not null)
        {
            return orgList;
        }
        else
            return null;
    }

    public async Task<BaseApiResponse> GetRepositories(SearchRepositoryListRequest repoSearchQuery)
    {
        var token = await _tokenRepository.getToken();
        if (token == null) return null;

        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user/repos?page={repoSearchQuery.PageNumber}&per_page={repoSearchQuery.PageSize}";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"},
                { "Authorization", $"Bearer {token.AccessToken}"},
            };
        var (repos, response) = 
            await _httpHelperServices.MakeHttpRequest<List<GithubRepositoryResponse>>(
                CloudBuildConstants.GITHUB_API_BASE_URI,
                url,
                HttpMethod.Get,
                null,
                headers,
                null
            );
        
        var linkHeader = response.Headers.TryGetValues("Link", out var linkValues)
            ? linkValues.FirstOrDefault()
            : null;
        var pageCount = 1;

        if(linkHeader is not null)
        {
            var match = Regex.Match(linkHeader, @"<[^>]*[?&]page=(\d+)[^>]*>; rel=""last""", RegexOptions.None, RegexTimeout);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var totalPages))
            {
                pageCount = totalPages;
            }
        }
        if (repos is not null)
        {
            return new BaseApiResponse
            {
                Data = new
                {
                    TotalCount = pageCount,
                    Items = repos
                },
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK
            };
        }

        return new BaseApiResponse
        {
            IsSuccess = false,
            StatusCode = HttpStatusCode.OK
        };
    }
    
    public async Task<BaseApiResponse> SearchUserRepositories(SearchRepositoryListRequest repoSearchQuery)
    {
        var token = await _tokenRepository.getToken();
        if (token == null) return null;
        string searchQuery = string.Join('+', [repoSearchQuery.Search,"fork:true", $"user:{token.UserName}", .. (token.Organizations ?? []).Select(org => $"org:{org.OrgUserName}")]);
        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/search/repositories?q={searchQuery}&per_page={repoSearchQuery.PageSize}&page={repoSearchQuery.PageNumber}";

        var headers = new Dictionary<string, string>
        {
            { "Accept", "application/vnd.github.v3+json" },
            { "User-Agent", "BlocksDevOps" },
            { "Authorization", $"Bearer {token.AccessToken}" }
        };

        var (result, response) = await _httpHelperServices.MakeHttpRequest<GithubSearchResponse>(CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Get, null, headers);
        if(response.IsSuccessStatusCode &&  result is not null)
        {
            return new BaseApiResponse()
            {
                Data = result,
                IsSuccess = true,
                StatusCode = HttpStatusCode.OK,
            };
        };
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            return new BaseApiResponse()
            {
                Data = result,
                IsSuccess = false,
                Message = "Authentication Failed.",
                StatusCode = HttpStatusCode.OK,
                Errors = new Dictionary<string, string>
                {
                    { "AUTHENTICATION_FAILED" , $"{token.Source} authenticatin failed." }
                }
            };
        }
        return new BaseApiResponse()
        {
            IsSuccess = false,
            Message = "Failed to get repositories.",
            StatusCode = HttpStatusCode.BadRequest,
        };
    }

    public async Task<List<Branch>> GetBranches(string repo)
    {
        var token = await _tokenRepository.getToken();
        if (token == null) return null;

        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo}/branches";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"},
                { "Authorization", $"Bearer {token.AccessToken}"},
            };
        var (branches, response) = await _httpHelperServices.MakeHttpGetRequest<List<Branch>>(url, null, headers);

        if (branches is not null)
        {
            return branches;
        }
        return null;
    }

    public async Task<(bool, string)> GetRepoBranchByName(string repo, string branch)
    {
        var token = await _tokenRepository.getToken();
        if (token == null) return (false, "Access token not found. Please authorize again.");

        var url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/repos/{repo}/branches/{branch}";
        var headers = new Dictionary<string, string>
            {
                { "Accept", "application/vnd.github.v3+json" },
                { "User-Agent", "BlocksDevOps"}
            };
        var (successResponse, errorResponse, response) = await _httpHelperServices.MakeHttpRequest<GithubRepoBranchResponse, GithubRepoBranchResponse>(CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Get ,null, headers, token.AccessToken);

        if (response.StatusCode == HttpStatusCode.OK)
        {
            return (true, null);
        }
        else if (response.StatusCode == HttpStatusCode.Unauthorized)
        { 
            return (false, $"Failed to access repository.");
        }
        else if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return (false, $"Repository {repo} does not have a branch named '{branch}'.");
        }
        return (false, null);
    }

    public async Task<GitPushCredentialResponse?> GetPushCredential()
    {
        var token = await _tokenRepository.getToken();
        if (token is null || string.IsNullOrWhiteSpace(token.AccessToken))
        {
            return null;
        }

        // Validated on every call, not trusted from storage: a revoked token
        // handed to a git client fails inside `git push` with a message the
        // owner can't act on. Failing here instead lets the CLI say
        // "reconnect GitHub" rather than "authentication failed".
        if (!await ValidateAccessToken(token))
        {
            return null;
        }

        return new GitPushCredentialResponse
        {
            Token = token.AccessToken,
            Login = token.UserName,
            ExpiresAt = null,
        };
    }

    public async Task<(GithubRepositoryResponse? repo, string? error)> CreateRepository(CreateRepositoryRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Name))
        {
            return (null, "A repository name is required.");
        }

        var token = await _tokenRepository.getToken();
        if (token is null)
        {
            return (null, "GitHub is not connected for this user.");
        }

        // An org the token doesn't list is refused here rather than by
        // GitHub, whose 404 for "no access to this org" is indistinguishable
        // from "org doesn't exist".
        string url;
        if (!string.IsNullOrWhiteSpace(request.Organization))
        {
            var known = token.Organizations?.Any(o => string.Equals(o.OrgUserName, request.Organization, StringComparison.OrdinalIgnoreCase)) ?? false;
            if (!known)
            {
                return (null, $"Organisation '{request.Organization}' is not one this GitHub account belongs to.");
            }

            url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/orgs/{request.Organization}/repos";
        }
        else
        {
            url = $"{CloudBuildConstants.GITHUB_API_BASE_URI}/user/repos";
        }

        var headers = new Dictionary<string, string>
        {
            { "Accept", "application/vnd.github.v3+json" },
            { "User-Agent", "BlocksDevOps" },
            { "Authorization", $"Bearer {token.AccessToken}" },
        };

        // auto_init deliberately false: the caller already has the code and
        // a first commit. A GitHub-made README would give the remote a
        // history the local one doesn't share, and the very first push
        // would be rejected as non-fast-forward.
        var payload = new
        {
            name = request.Name,
            description = request.Description ?? string.Empty,
            @private = request.Private,
            auto_init = false,
        };

        var (repo, response) = await _httpHelperServices.MakeHttpRequest<GithubRepositoryResponse>(
            CloudBuildConstants.GITHUB_API_BASE_URI, url, HttpMethod.Post, payload, headers, null);

        if (response.StatusCode == HttpStatusCode.Created && repo is not null)
        {
            return (repo, null);
        }

        return response.StatusCode switch
        {
            HttpStatusCode.UnprocessableEntity => (null, $"GitHub refused to create '{request.Name}' — a repository with that name probably already exists."),
            HttpStatusCode.Unauthorized => (null, "GitHub rejected the stored token. Reconnect GitHub and try again."),
            HttpStatusCode.Forbidden => (null, "The connected GitHub account is not allowed to create repositories here."),
            _ => (null, $"GitHub returned {(int)response.StatusCode} while creating the repository."),
        };
    }
}