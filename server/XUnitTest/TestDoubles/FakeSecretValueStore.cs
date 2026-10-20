using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Blocks.Secrets;

namespace XUnitTest.TestDoubles;

/// <summary>
/// In-memory <see cref="ISecretValueStore"/> for the GitHub token tests. It records every call in
/// order, keeps soft-deleted values apart from live ones, and can be told to fail an operation
/// the way <c>KeyVaultSecretValueStore</c> does (a <see cref="SecretVaultException"/>).
/// </summary>
internal sealed class FakeSecretValueStore : ISecretValueStore
{
    private readonly ConcurrentQueue<(string Operation, string SecretId)> _calls = new();
    private readonly Dictionary<string, Func<string, Exception>> _failures = new(StringComparer.Ordinal);

    public ConcurrentDictionary<string, string> Values { get; } = new(StringComparer.Ordinal);

    public ConcurrentDictionary<string, string> SoftDeleted { get; } = new(StringComparer.Ordinal);

    public IReadOnlyList<(string Operation, string SecretId)> Calls => _calls.ToList();

    /// <summary>Calls whose operation is <paramref name="operation"/>.</summary>
    public IReadOnlyList<string> CallsTo(string operation) =>
        _calls.Where(c => c.Operation == operation).Select(c => c.SecretId).ToList();

    /// <summary>Makes <paramref name="operation"/> (set/get/delete) throw a vault failure.</summary>
    public void Fail(string operation, int status = 503) =>
        _failures[operation] = id => VaultFailure(operation, id, status);

    /// <summary>Makes <paramref name="operation"/> throw whatever <paramref name="failure"/> builds.</summary>
    public void Fail(string operation, Func<string, Exception> failure) =>
        _failures[operation] = failure;

    public static SecretVaultException VaultFailure(string operation, string secretId, int status) =>
        new("Key Vault request failed.", operation, secretId,
            new RequestFailedException(status, status == 429 ? "Too Many Requests" : "Service Unavailable"));

    public static SecretVaultException VaultFailureWithMessage(string operation, string message) =>
        new(message, operation, null!, new RequestFailedException(500, message));

    public Task SetAsync(string secretId, string value, CancellationToken cancellationToken = default)
    {
        Record("set", secretId);
        Values[secretId] = value;
        return Task.CompletedTask;
    }

    public Task<string?> GetAsync(string secretId, CancellationToken cancellationToken = default)
    {
        Record("get", secretId);
        return Task.FromResult(Values.TryGetValue(secretId, out var value) ? value : null);
    }

    public Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
    {
        Record("delete", secretId);
        if (Values.TryRemove(secretId, out var value))
        {
            SoftDeleted[secretId] = value;
        }

        return Task.CompletedTask;
    }

    private void Record(string operation, string secretId)
    {
        _calls.Enqueue((operation, secretId));
        if (_failures.TryGetValue(operation, out var failure))
        {
            throw failure(secretId);
        }
    }
}
