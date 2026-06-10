using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using Devops.DomainService.Shared.Entities;
using Devops.DomainService.VersionControlSystems.Services;
using Devops.DomainService.VersionControlSystems.Interfaces;

namespace Api.Controllers;

[ApiController]
[Route("[controller]/[action]")]
public class AuthController : ControllerBase
{

    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }


    [Authorize]
    [HttpGet]
    public async Task<IActionResult> IsAuthorized()
    {
        var response = await _authService.isAuthorized();
        return Ok(response);
    }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult> AccessToken([FromQuery] string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(
                new BaseApiResponse
                {
                    IsSuccess = false,
                    Message = "Code is required",
                    StatusCode = HttpStatusCode.BadRequest,
                    Errors = new Dictionary<string, string>
                    {
                        { "Exception", "Code is required"}
                    }
                });
        }
        var response = await _authService.GetAccessToken(code);
        if (response.IsSuccess) 
        {
            return Ok(response);
        }
        return BadRequest(response);
    }


    [Authorize]
    [HttpPost]
    public async Task<IActionResult> RemoveAuthorization()
    {
        var response = await _authService.RevokeOauthAccess();
        return Ok(response);
    }

    [Authorize]
    [HttpDelete]
    public async Task<IActionResult> DeleteAuthorization()
    {
        var response = await _authService.DeleteToken();
        if (response.StatusCode == HttpStatusCode.OK)
        {
            return Ok(response);
        }
        return BadRequest(response);
    }

    [HttpGet]
    public async Task<IActionResult> TestPing()
    {
        var response = new BaseApiResponse()
        {
            IsSuccess = true,
            Message = "Pong",
            StatusCode = HttpStatusCode.OK
        };
        return Ok(response);
        
    }
}