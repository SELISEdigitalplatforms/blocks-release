using System.Collections.Generic;
using System.Linq;
using Devops.DomainService.Shared.Services;
using FluentAssertions;

namespace XUnitTest.Devops.Shared
{
    public class MapServiceTests
    {
        private class Source
        {
            public string Name { get; set; }
            public int Age { get; set; }
            public string OnlyOnSource { get; set; }
            public int? NullableNumber { get; set; }
        }

        private class Destination
        {
            public string Name { get; set; }
            public int Age { get; set; }
            public int? NullableNumber { get; set; }
            public string ReadOnly { get; } = "fixed";
        }

        private class NumbersSource
        {
            public string Value { get; set; }
            public int Count { get; set; }
        }

        private class NumbersDest
        {
            public int Value { get; set; }
            public string Count { get; set; }
        }

        private class Inner
        {
            public string Text { get; set; }
        }

        private class InnerDto
        {
            public string Text { get; set; }
        }

        private class NestedSource
        {
            public Inner Child { get; set; }
            public List<Inner> Items { get; set; }
        }

        private class NestedDest
        {
            public InnerDto Child { get; set; }
            public List<InnerDto> Items { get; set; }
        }

        private class ArraySource
        {
            public string[] Tags { get; set; }
        }

        private class ArrayDest
        {
            public string[] Tags { get; set; }
        }

        [Fact]
        public void Map_NullSource_ReturnsNull()
        {
            var result = MapService.Map<Source, Destination>(null);
            result.Should().BeNull();
        }

        [Fact]
        public void Map_CopiesMatchingProperties_CaseInsensitive()
        {
            var source = new Source { Name = "Alice", Age = 30 };

            var result = MapService.Map<Source, Destination>(source);

            result.Should().NotBeNull();
            result.Name.Should().Be("Alice");
            result.Age.Should().Be(30);
        }

        [Fact]
        public void Map_DoesNotOverwriteReadOnlyProperty()
        {
            var source = new Source { Name = "Bob", Age = 5 };

            var result = MapService.Map<Source, Destination>(source);

            result.ReadOnly.Should().Be("fixed");
        }

        [Fact]
        public void Map_NullableWithValue_IsCopied()
        {
            var source = new Source { NullableNumber = 42 };

            var result = MapService.Map<Source, Destination>(source);

            result.NullableNumber.Should().Be(42);
        }

        [Fact]
        public void Map_NullNullable_StaysNull()
        {
            var source = new Source { NullableNumber = null };

            var result = MapService.Map<Source, Destination>(source);

            result.NullableNumber.Should().BeNull();
        }

        [Fact]
        public void Map_ExistingDestination_NullSource_ReturnsDestinationUnchanged()
        {
            var dest = new Destination { Name = "keep" };

            var result = MapService.Map<Source, Destination>(null, dest);

            result.Should().BeSameAs(dest);
            result.Name.Should().Be("keep");
        }

        [Fact]
        public void Map_ExistingDestination_NullDestination_ReturnsNull()
        {
            var source = new Source { Name = "x" };

            var result = MapService.Map<Source, Destination>(source, null);

            result.Should().BeNull();
        }

        [Fact]
        public void Map_PrimitiveConversion_StringToIntAndIntToString()
        {
            var source = new NumbersSource { Value = "123", Count = 7 };

            var result = MapService.Map<NumbersSource, NumbersDest>(source);

            result.Value.Should().Be(123);
            result.Count.Should().Be("7");
        }

        [Fact]
        public void Map_PrimitiveConversion_InvalidValue_ReturnsDefault()
        {
            var source = new NumbersSource { Value = "not-a-number" };

            var result = MapService.Map<NumbersSource, NumbersDest>(source);

            result.Value.Should().Be(0);
        }

        [Fact]
        public void Map_NestedComplexObject_IsMapped()
        {
            var source = new NestedSource { Child = new Inner { Text = "deep" } };

            var result = MapService.Map<NestedSource, NestedDest>(source);

            result.Child.Should().NotBeNull();
            result.Child.Text.Should().Be("deep");
        }

        [Fact]
        public void Map_ListOfComplexObjects_IsMapped()
        {
            var source = new NestedSource
            {
                Items = new List<Inner> { new Inner { Text = "a" }, null, new Inner { Text = "b" } }
            };

            var result = MapService.Map<NestedSource, NestedDest>(source);

            result.Items.Should().HaveCount(3);
            result.Items[0].Text.Should().Be("a");
            result.Items[1].Should().BeNull();
            result.Items[2].Text.Should().Be("b");
        }

        [Fact]
        public void Map_Array_IsMappedToArray()
        {
            var source = new ArraySource { Tags = new[] { "x", "y" } };

            var result = MapService.Map<ArraySource, ArrayDest>(source);

            result.Tags.Should().NotBeNull();
            result.Tags.Should().BeEquivalentTo(new[] { "x", "y" });
        }
    }
}
