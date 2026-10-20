using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;

namespace XUnitTest.TestDoubles;

/// <summary>A single-batch <see cref="IAsyncCursor{T}"/> over a fixed list.</summary>
internal sealed class ListCursor<T> : IAsyncCursor<T>
{
    private readonly IEnumerable<T> _items;
    private bool _moved;

    public ListCursor(IEnumerable<T> items) => _items = items;

    public IEnumerable<T> Current => _moved ? _items : [];

    public bool MoveNext(CancellationToken cancellationToken = default)
    {
        if (_moved)
        {
            return false;
        }

        _moved = true;
        return true;
    }

    public Task<bool> MoveNextAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(MoveNext(cancellationToken));

    public void Dispose()
    {
    }
}
