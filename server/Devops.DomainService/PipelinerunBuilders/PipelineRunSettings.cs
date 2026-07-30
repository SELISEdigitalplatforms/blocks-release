using System.Text.RegularExpressions;
using Devops.DomainService.Shared.Utilities;
using YamlDotNet.Serialization;

namespace Devops.DomainService.PipelinerunBuilders;

public class PipelineRunSettings
{
    private IDictionary<string, object> myDictionary;
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);
    private static readonly IDeserializer _deser = new DeserializerBuilder()
        .WithAttemptingUnquotedStringTypeDeserialization().Build();
    private string filePath;
    private string metadataNamespace;
    private string repoUrl;
    private string imageReference;
    private string branchName;
    private string appName;
    private string paramNamespace;
    private string username;
    private string domains;
    private string cpu;
    private string memory;
    private string accessToken;
    private string sonarQubeProjectKey;
    private string cliBuildEnv;

    public PipelineRunSettings(IDictionary<string, object> root) => myDictionary = root;

    public IDictionary<string, object> build()
    {
        validate();
        applyMetadataNamespace();
        applyRepoUrl();
        applyImageReference();
        applyBranchName();
        applyAppName();
        applyParamNamespace();
        applyUsername();
        applyDomain();
        applyCpu();
        applyMemory();
        applySonarQube();
        applyCliBuildEnv();
        return myDictionary;
    }

    public static PipelineRunSettings fromYamlFile(string path) =>
        new(_deser.Deserialize<IDictionary<string, object>>(File.ReadAllText(path)));

    public PipelineRunSettings setMetadataNamespace(string ns)
    {
        metadataNamespace = Regex.Replace(ns, "[^a-zA-Z0-9]", "-", RegexOptions.None, RegexTimeout).ToLower().Trim()
                    .Trim('-')
                    .ToLower().Substring(0, Math.Min(63, ns.Length));
        return this;
    }

    public PipelineRunSettings setAccessToken(string accessToken)
    {
        this.accessToken = accessToken;
        return this;
    }

    public PipelineRunSettings setRepoUrl(string repoUrl)
    {
        this.repoUrl = repoUrl;
        return this;
    }

    public PipelineRunSettings setImageReference(string imageReference)
    {
        this.imageReference = imageReference;
        return this;
    }

    public PipelineRunSettings setBranchName(string branchName)
    {
        this.branchName = branchName;
        return this;
    }

    public PipelineRunSettings setAppName(string appName)
    {
        if (appName == null)
        {
            this.appName = $"unknown-{Guid.NewGuid().ToString().ToLower()}";
            return this;
        }
        var formattedAppName = Regex.Replace(appName, "[^a-zA-Z0-9]", "-", RegexOptions.None, RegexTimeout).ToLower().Trim()
                    .Trim('-')
                    .ToLower();
        this.appName = formattedAppName.Substring(0, Math.Min(63, formattedAppName.Length));
        return this;
    }

    public PipelineRunSettings setParamNamespace(string userId, string repoUrl)
    {
        repoUrl = repoUrl.Substring(0, repoUrl.Length).Split('/').Last();
        var modifiedRepoUrl = $"{appName}-{repoUrl}";
        setSonarQubeProjectKey(modifiedRepoUrl);
        modifiedRepoUrl = Regex.Replace(modifiedRepoUrl, "[^a-zA-Z0-9]", "-", RegexOptions.None, RegexTimeout).Trim('-').Substring(0, Math.Min(63, modifiedRepoUrl.Length));
        paramNamespace = modifiedRepoUrl.Trim().Trim('-').ToLower();
        return this;
    }

    public PipelineRunSettings setUsername(string username)
    {
        this.username = username;
        return this;
    }

    public PipelineRunSettings setDomain(string defaultDomain, string customDomain)
    {
        defaultDomain = Regex.Replace(defaultDomain, @"^https?://", "", RegexOptions.IgnoreCase, RegexTimeout).ToLower();
        customDomain = string.IsNullOrWhiteSpace(customDomain) ? null : Regex.Replace(customDomain, @"^https?://", "", RegexOptions.IgnoreCase, RegexTimeout).ToLower();
        domains = string.Join(",", new[] { defaultDomain, customDomain }.Where(domain => !string.IsNullOrWhiteSpace(domain)));
        return this;
    }

    public PipelineRunSettings setCpu(string cpu)
    {
        this.cpu = cpu;
        return this;
    }

    public PipelineRunSettings setMemory(string memory)
    {
        this.memory = memory;
        return this;
    }

    public PipelineRunSettings setSonarQubeProjectKey(string repoName)
    {
        sonarQubeProjectKey = repoName.Replace("/", "-");
        Console.WriteLine($" Sonar project key: {sonarQubeProjectKey}");
        return this;
    }

    public PipelineRunSettings setCliBuildEnv(string env)
    {
        cliBuildEnv = env;
        Console.WriteLine($" Build env : {cliBuildEnv}");
        return this;
    }

    private void applyMetadataNamespace()
    {
        if (metadataNamespace == null)
            return;
        var metadata = myDictionary["metadata"] as Dictionary<object, object>;
        metadata["name"] = metadataNamespace;
    }

    private void applyRepoUrl()
    {
        if (repoUrl == null)
            return;
        if (accessToken == null)
        {
            applyParams("repo-url", repoUrl);
            return;
        }

        string prefixString = "https://";
        if (repoUrl.StartsWith("http://"))
            prefixString = "http://";

        var repoUrlWithAccessToken = prefixString + accessToken + "@" + repoUrl.Substring(prefixString.Length);
        applyParams("repo-url", repoUrlWithAccessToken);
    }

    private void applyImageReference()
    {
        if (imageReference == null)
            return;
        applyParams("image-reference", imageReference);
    }

    private void applyBranchName()
    {
        if (branchName == null)
            return;
        applyParams("revision", branchName);
    }

    private void applyAppName()
    {
        if (appName == null)
            return;
        applyParams("app-name", appName);
    }

    private void applyParamNamespace()
    {
        if (paramNamespace == null)
            return;
        applyParams("namespace", paramNamespace);
    }

    private void applyUsername()
    {
        if (username == null)
            return;
        applyParams("username", username);
    }

    private void applyDomain()
    {
        if (domains == null)
            return;
        applyParams("domains", domains);
    }

    private void applyCpu()
    {
        if (cpu == null)
            return;
        applyParams("cpu", cpu);
    }

    private void applyMemory()
    {
        if (memory == null)
            return;
        applyParams("memory", memory);
    }

    private void applySonarQube()
    {
        if (sonarQubeProjectKey == null)
            return;
        applyParams("sonar-project-key", sonarQubeProjectKey);
    }

    private void applyCliBuildEnv()
    {
        if (cliBuildEnv == null)
            return;
        CloudBuildConstants.BranchToEnvironmentMap.TryGetValue(cliBuildEnv, out var buildEnv);
        applyListParams("extra-args", new List<string> { "--build-arg", $"ci_build={buildEnv ?? cliBuildEnv}" });
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

    private void applyListParams(string key, List<string> values)
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
                item["value"] = values.Cast<object>().ToList();
                return;
            }
        }

        throw new InvalidDataException("Parameter " + key + " not found.");
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
