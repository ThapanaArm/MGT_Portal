-- Select the Portal database before running.
ALTER TABLE [dbo].[AppCodeReviews] ADD
    [ResolvedInCycle] int NULL,
    [ResolvedBy] nvarchar(max) NULL,
    [ResolvedAt] datetime2 NULL;
