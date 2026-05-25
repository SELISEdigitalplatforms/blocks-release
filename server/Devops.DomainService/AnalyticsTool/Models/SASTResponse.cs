using System.Text.Json.Serialization;

namespace Devops.DomainService.TestingTools.Models;

public class SASTResponse
{
    [JsonPropertyName("component")]
    public Component Component { get; set; }
}

public class Component
{
    [JsonPropertyName("key")]
    public string Key { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; }

    [JsonPropertyName("qualifier")]
    public string Qualifier { get; set; }

    [JsonPropertyName("measures")]
    public List<Measure> Measures { get; set; }
}

public class Measure
{
    [JsonPropertyName("metric")]
    public string Metric { get; set; }

    [JsonPropertyName("value")]
    public string Value { get; set; }

    [JsonPropertyName("bestValue")]
    public bool BestValue { get; set; }

    [JsonPropertyName("period")]
    public Period Period { get; set; }

}

public class Period
{
    public int index { get; set; }
    public string value { get; set; }
    public bool? bestValue { get; set; }
    public string mode { get; set; }
    public DateTime date { get; set; }
}