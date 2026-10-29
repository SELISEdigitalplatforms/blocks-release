using System;

namespace XUnitTest.TestDoubles;

/// <summary>A clock that stands still at <see cref="Now"/>, for code that takes a <see cref="TimeProvider"/>.</summary>
internal sealed class FakeTimeProvider : TimeProvider
{
    public FakeTimeProvider(DateTimeOffset now) => Now = now;

    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;
}
