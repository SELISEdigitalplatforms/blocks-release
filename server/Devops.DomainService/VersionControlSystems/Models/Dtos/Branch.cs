namespace Devops.DomainService.VersionControlSystems.Models.Dtos;

public class Branch
{
    public string name { get; set; }
    public Commit commit { get; set; }
}

public class Commit
{
    public string sha { get; set; }
    public string url { get; set; }
}