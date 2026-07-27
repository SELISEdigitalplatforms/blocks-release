using System;
using System.Net;
using System.Net.Http;
using Devops.DomainService.Shared.Utilities;
using FluentAssertions;
using k8s.Autorest;

namespace XUnitTest.Devops.Shared
{
    public class KubernetesApiErrorHandlerTests
    {
        private static HttpOperationException MakeException(HttpStatusCode code, string content)
        {
            var wrapper = new HttpResponseMessageWrapper(new HttpResponseMessage(code), content);
            return new HttpOperationException("k8s error") { Response = wrapper };
        }

        [Theory]
        [InlineData(HttpStatusCode.BadRequest, "Bad Request (400)")]
        [InlineData(HttpStatusCode.Unauthorized, "Unauthorized (401)")]
        [InlineData(HttpStatusCode.Forbidden, "Forbidden (403)")]
        [InlineData(HttpStatusCode.NotFound, "Not Found (404)")]
        [InlineData(HttpStatusCode.Conflict, "Conflict (409)")]
        [InlineData(HttpStatusCode.UnprocessableEntity, "Unprocessable Entity (422)")]
        [InlineData(HttpStatusCode.InternalServerError, "Internal Server Error (500)")]
        [InlineData(HttpStatusCode.ServiceUnavailable, "Service Unavailable (503)")]
        public void HandleKubernetesError_KnownStatus_ReturnsMappedMessage(HttpStatusCode code, string expectedPrefix)
        {
            var ex = MakeException(code, "some-content");

            var message = KubernetesApiErrorHandler.HandleKubernetesError(ex);

            message.Should().StartWith(expectedPrefix);
        }

        [Fact]
        public void HandleKubernetesError_UnknownStatus_ReturnsUnexpected()
        {
            var ex = MakeException(HttpStatusCode.Gone, "gone-content");

            var message = KubernetesApiErrorHandler.HandleKubernetesError(ex);

            message.Should().StartWith("Unexpected Kubernetes error");
            message.Should().Contain("gone-content");
        }

        [Fact]
        public void HandleGeneralError_TaskCanceled_ReturnsTimeoutMessage()
        {
            var message = KubernetesApiErrorHandler.HandleGeneralError(new TaskCanceledException());

            message.Should().Be("Request timeout: operation took too long.");
        }

        [Fact]
        public void HandleGeneralError_HttpRequestException_ReturnsNetworkMessage()
        {
            var message = KubernetesApiErrorHandler.HandleGeneralError(new HttpRequestException("boom"));

            message.Should().StartWith("Network error:");
            message.Should().Contain("boom");
        }

        [Fact]
        public void HandleGeneralError_OtherException_ReturnsUnexpectedMessage()
        {
            var message = KubernetesApiErrorHandler.HandleGeneralError(new InvalidOperationException("weird"));

            message.Should().StartWith("Unexpected error:");
            message.Should().Contain("weird");
        }
    }
}
