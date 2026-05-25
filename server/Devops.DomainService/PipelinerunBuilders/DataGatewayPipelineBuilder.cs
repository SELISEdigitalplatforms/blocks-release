using YamlDotNet.Serialization;

namespace Devops.DomainService.PipelinerunBuilders;

public class DataGatewayPipelineBuilder
{
    private IDictionary<string, object> myDictionary;
    private static readonly IDeserializer _deser = new DeserializerBuilder()
        .WithAttemptingUnquotedStringTypeDeserialization().Build();
    private string metaDataName;
    private string projectKey;
    private string version;
    private string clusterNames;
    private string repoUrl;
    private string revision;
    private string tenantId;

    public DataGatewayPipelineBuilder(IDictionary<string, object> root) => myDictionary = root;

    public IDictionary<string, object> build()
    {
        //validate();
        applyMetadataName();
        applyProjectKey();
        applyVersion();
        applyClusterNames();
        applyRepoUrl();
        applyRevision();
        applyTenantId();
        return myDictionary;
    }

    public DataGatewayPipelineBuilder setMetadataName(string name)
    {
        metaDataName = name;
        return this;
    }

    public DataGatewayPipelineBuilder setProjectKey(string projectKey)
    {
        this.projectKey = projectKey;
        return this;
    }

    public DataGatewayPipelineBuilder setVersion(string version)
    {
        this.version = version;
        return this;
    }

    public DataGatewayPipelineBuilder setClusterNames(string clusterNames)
    {
        this.clusterNames = clusterNames;
        return this;
    }

    public DataGatewayPipelineBuilder setTenantId(string tenantId)
    {
        this.tenantId = tenantId;
        return this;
    }

    public DataGatewayPipelineBuilder setRepoUrl(string accessToken)
    {
        string repoUrl = ExtractParamValue("repo-url");

        string prefixString = "https://";
        if (repoUrl.StartsWith("http://"))
            prefixString = "http://";

        var repoUrlWithAccessToken = prefixString + accessToken + repoUrl.Substring(prefixString.Length);
        this.repoUrl = repoUrlWithAccessToken;

        return this;
    }

    public DataGatewayPipelineBuilder setRevision(string revision)
    {
        this.revision = revision;
        return this;
    }

    public static DataGatewayPipelineBuilder fromYamlFile(string path) =>
        new(_deser.Deserialize<IDictionary<string, object>>(File.ReadAllText(path)));

    private void applyProjectKey()
    {
        if (projectKey == null)
            return;
        applyParams("project-key", projectKey);
    }

    private void applyVersion()
    {
        if (version == null)
            return;
        applyParams("version", version);
    }

    private void applyMetadataName()
    {
        if (metaDataName == null)
            return;
        var metadata = myDictionary["metadata"] as Dictionary<object, object>;
        metadata["name"] = metaDataName;
    }

    private void applyClusterNames()
    {
        if (clusterNames == null)
            return;
        applyParams("cluster-names", clusterNames);
    }

    private void applyRepoUrl()
    {
        if (repoUrl == null)
            return;
        applyParams("repo-url", repoUrl);
    }

    private void applyRevision()
    {
        if (revision == null)
            return;
        applyParams("revision", revision);
    }

    private void applyTenantId()
    {
        if (tenantId == null)
            return;
        applyParams("tenant-id", tenantId);
    }

    private void applyParams(string key, string value)
    {
        if (!myDictionary.TryGetValue("spec", out var specObj) ||
        specObj is not IDictionary<object, object> spec)
            throw new InvalidDataException("YAML has no spec section.");

        if (!spec.TryGetValue("params", out var listObj) ||
            listObj is not IList<object> paramList)
            throw new InvalidDataException("YAML has no spec.params list.");

        foreach (var item in paramList.OfType<IDictionary<object, object>>())
        {
            if (item.TryGetValue("name", out var nameObj) &&
                nameObj?.ToString() == key)
            {
                item["value"] = value;
                return;
            }
        }
        throw new InvalidDataException("Parameter" + key + " not found.");
    }


    private string ExtractParamValue(string key)
    {
        if (!myDictionary.TryGetValue("spec", out var specObj) || specObj is not IDictionary<object, object> spec)
            return null;

        if (!spec.TryGetValue("params", out var listObj) || listObj is not IList<object> paramList)
            return null;

        foreach (var item in paramList.OfType<IDictionary<object, object>>())
        {
            if (item.TryGetValue("name", out var nameObj) && nameObj?.ToString() == key)
                return item.TryGetValue("value", out var valObj) ? valObj?.ToString() : null;
        }

        return null;
    }

    private void validate()
    {
        static string Missing(string k) => $"YAML missing required field '{k}'";

        if (!myDictionary.TryGetValue("apiVersion", out var apiVersion) ||
                (string)apiVersion != "tekton.dev/v1beta1")
        {
            throw new InvalidDataException(Missing("apiVersion"));
        }

        if (!myDictionary.TryGetValue("kind", out var kind) || (string)kind != "PipelineRun")
        {
            Console.WriteLine("Invalid kind. Must be PipelineRun");
            throw new InvalidDataException(Missing("Invalid kind. Must be PipelineRun"));
        }
    }

}
