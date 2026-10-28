namespace MGT.Portal.Api.Modules.Apps;

public class CommitteeMember
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string RoleTitle { get; set; } = ""; // e.g. IT Security, Business Owner, Compliance
    public int? UserId { get; set; }
    public MGT.Portal.Api.Modules.Identity.User? User { get; set; }

    public ICollection<AppVote> Votes { get; set; } = new List<AppVote>();
}
