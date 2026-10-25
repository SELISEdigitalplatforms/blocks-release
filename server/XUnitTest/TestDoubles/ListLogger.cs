using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;

namespace XUnitTest.TestDoubles;

/// <summary>A logger that keeps every formatted entry, so tests can assert what was (not) logged.</summary>
internal sealed class ListLogger<T> : ILogger<T>
{
    private readonly ConcurrentQueue<(LogLevel Level, string Message, Exception? Exception)> _entries = new();

    public IReadOnlyList<(LogLevel Level, string Message, Exception? Exception)> Entries => _entries.ToList();

    /// <summary>Every message plus every exception chain's messages, for "never logged" checks.</summary>
    public string AllText => string.Join("\n", _entries.Select(e => e.Message + "\n" + e.Exception));

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        ArgumentNullException.ThrowIfNull(formatter);
        _entries.Enqueue((logLevel, formatter(state, exception), exception));
    }
}
