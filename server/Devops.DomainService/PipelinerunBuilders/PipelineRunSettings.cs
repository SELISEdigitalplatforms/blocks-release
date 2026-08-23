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
    private IReadOnlyDictionary<string, string> extraBuildArgs = new Dictionary<string, string>();

    public PipelineRunSettings(IDictionary<string, object> root) => myDictionary = root;

    /// <summary>
    /// The exact value applied to the `namespace` param of the PipelineRun. Exposed so the caller can
    /// persist it verbatim - it must never be recomputed once the PipelineRun has been submitted.
    /// </summary>
    public string ParamNamespace => paramNamespace;

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
        applyBuildArgs();
        return myDictionary;
    }

    public static PipelineRunSettings fromYamlFile(string path) =>
        fromYaml(File.ReadAllText(path));

    /// <summary>
    /// Builds settings from a definition held in memory, so a PipelineRun no longer has to come from
    /// disk. The document is mutated in place by <see cref="build"/>: params are located by name, so
    /// anything an environment's own definition adds survives untouched.
    /// </summary>
    public static PipelineRunSettings fromYaml(string yaml)
    {
        if (string.IsNullOrWhiteSpace(yaml))
            throw new InvalidDataException("PipelineRun YAML is empty.");

        return new(_deser.Deserialize<IDictionary<string, object>>(yaml));
    }

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

    /// <summary>
    /// Per-repository values forwarded to the image build as additional --build-arg pairs,
    /// alongside the ci_build one. Null or empty leaves the run exactly as it was before.
    /// </summary>
    /// <remarks>
    /// A Dockerfile only receives an arg it declares with a matching ARG instruction; kaniko
    /// drops the rest without failing the build. So a repository can carry a key its Dockerfile
    /// has not adopted yet, and its builds keep working unchanged.
    /// </remarks>
    public PipelineRunSettings setExtraBuildArgs(IReadOnlyDictionary<string, string> buildArgs)
    {
        extraBuildArgs = buildArgs ?? new Dictionary<string, string>();
        Console.WriteLine($" Extra build args : {extraBuildArgs.Count}");
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

    /// <summary>
    /// Writes the whole extra-args list: the ci_build pair first, then any per-repository pairs.
    /// </summary>
    /// <remarks>
    /// applyListParams assigns rather than merges, so this is the single writer of extra-args -
    /// whatever the source document holds is replaced. When there is nothing to write the
    /// document keeps its own value, which is the pre-existing behaviour for a run with no
    /// build env.
    /// </remarks>
    private void applyBuildArgs()
    {
        var args = new List<string>();

        if (cliBuildEnv != null)
        {
            CloudBuildConstants.BranchToEnvironmentMap.TryGetValue(cliBuildEnv, out var buildEnv);
            args.Add("--build-arg");
            args.Add($"ci_build={buildEnv ?? cliBuildEnv}");
        }

        foreach (var pair in extraBuildArgs)
        {
            // A blank key would produce a "=value" arg that kaniko rejects, failing a build over
            // a stray entry. RepoSecretService already enforces the POSIX name rule on save; this
            // only guards a set that reached the vault by some other route.
            if (string.IsNullOrWhiteSpace(pair.Key))
                continue;

            args.Add("--build-arg");
            args.Add($"{pair.Key}={pair.Value}");
        }

        if (args.Count == 0)
            return;

        applyListParams("extra-args", args);
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
