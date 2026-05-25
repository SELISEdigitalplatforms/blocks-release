using Blocks.Genesis;
using Microsoft.AspNetCore.Authorization;
using CloudConfiguration.DomainService.Notification.Entities;
using CloudConfiguration.DomainService.Notification.RequestModel;
using CloudConfiguration.DomainService.Notification.ResponseModel;
using CloudConfiguration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class NotificationController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;

        public NotificationController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }

        [HttpPost]
        [Authorize]
        public async Task<BaseResponse> Save([FromBody] SaveNotificatonConfigurationRequest request)
        {
            return await _configurationService.SaveNotificationConfigurationAsync(request);
        }

        [HttpGet]
        [Authorize]
        public async Task<GetNotificationConfigurationsResponse> Gets([FromQuery] GetNotificationConfigurationsRequest request)
        {
            return await _configurationService.GetNotificationConfigurationsAsync(request);
        }

        [HttpGet]
        [Authorize]
        public async Task<NotificationConfiguration> Get([FromQuery] GetNotificationConfigurationRequest request)
        {
            return await _configurationService.GetNotificatoinConfigurationAsync(request);
        }

        [HttpDelete]
        [Authorize]
        public async Task<BaseResponse> Delete([FromQuery] DeleteNotificatoinConfigurationRequest request)
        {
            return await _configurationService.DeleteNotificationConfigurationAsync(request);
        }
    }
}
