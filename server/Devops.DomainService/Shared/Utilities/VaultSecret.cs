using System.Text;

namespace Devops.DomainService.Shared.Utilities
{
    /// <summary>
    /// Helpers for secrets whose value is a multi-line document rather than a single token.
    /// </summary>
    public static class VaultSecret
    {
        /// <summary>
        /// Reads a document-valued secret. These are stored base64-encoded so that multi-line
        /// content survives transport into Key Vault; a plain-text value is accepted as well, in
        /// case one is ever set by hand through the portal. A value that is not valid base64 is
        /// returned unchanged.
        /// </summary>
        public static string DecodeText(string secretValue)
        {
            if (string.IsNullOrWhiteSpace(secretValue))
                return secretValue;

            var trimmed = secretValue.Trim();

            // The decoded form is ~3/4 of the encoded length, so the input length is always a
            // large enough destination buffer.
            var buffer = new byte[trimmed.Length];

            return Convert.TryFromBase64String(trimmed, buffer, out var written)
                ? Encoding.UTF8.GetString(buffer, 0, written)
                : secretValue;
        }
    }
}
