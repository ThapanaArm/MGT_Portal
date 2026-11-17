namespace MGT.Portal.Api.Modules.Identity;

public static class SalesDepartment
{
    public static bool IsSales(string? value) => value?.Trim().ToUpperInvariant() is
        "SALE" or "SALES" or "SALES DEPARTMENT" or "ฝ่ายขาย" or "แผนกขาย" or "ทีมขาย";

    public static bool IsSales(Team? team) => team is not null && (IsSales(team.Key) || IsSales(team.Name));
}
