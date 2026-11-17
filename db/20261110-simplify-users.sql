BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    EXEC(N'
    INSERT INTO [AuditLogs]
        ([BatchId], [OccurredAt], [Actor], [EntityType], [EntityId], [EntityKeyJson], [EventName], [Action], [Result], [ChangedFieldsJson], [BeforeJson], [CorrelationId])
    SELECT NEWID(), SYSUTCDATETIME(), N''system'', N''User'', CONVERT(nvarchar(320), u.[Id]),
        (SELECT u.[Id], u.[Email] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        N''user.schema_simplified'', N''SchemaUpdate'', N''Succeeded'',
        N''["DirectoryLevelOverride","DirectoryRoleManaged","DirectorySourceRole","DisplayNameOptionId","LastSyncedAt","TokenVersion"]'',
        (SELECT u.[DirectoryLevelOverride], u.[DirectoryRoleManaged], u.[DirectorySourceRole], u.[DisplayNameOptionId], u.[LastSyncedAt], u.[TokenVersion]
         FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER),
        N''migration:20261110130000''
    FROM [Users] AS u;

    UPDATE u SET u.[DisplayName] = o.[Name]
    FROM [Users] u INNER JOIN [DisplayNameOptions] o ON o.[Id] = u.[DisplayNameOptionId]
    WHERE NULLIF(LTRIM(RTRIM(u.[DisplayName])), N'''') IS NULL;

    UPDATE [Users] SET [Level] = [DirectoryLevelOverride]
    WHERE NULLIF(LTRIM(RTRIM([Level])), N'''') IS NULL
      AND [DirectoryLevelOverride] IN (N''employee'', N''sales_manager'', N''manager'', N''management'');
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_DisplayNameOptions_DisplayNameOptionId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DROP INDEX [IX_Users_DisplayNameOptionId] ON [Users];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'DirectoryLevelOverride');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [Users] DROP COLUMN [DirectoryLevelOverride];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'DirectoryRoleManaged');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [Users] DROP COLUMN [DirectoryRoleManaged];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'DirectorySourceRole');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [Users] DROP COLUMN [DirectorySourceRole];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var3 nvarchar(max);
    SELECT @var3 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'DisplayNameOptionId');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var3 + ';');
    ALTER TABLE [Users] DROP COLUMN [DisplayNameOptionId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var4 nvarchar(max);
    SELECT @var4 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'LastSyncedAt');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var4 + ';');
    ALTER TABLE [Users] DROP COLUMN [LastSyncedAt];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    DECLARE @var5 nvarchar(max);
    SELECT @var5 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'TokenVersion');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT ' + @var5 + ';');
    ALTER TABLE [Users] DROP COLUMN [TokenVersion];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110130000_SimplifyUserDirectoryColumns'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110130000_SimplifyUserDirectoryColumns', N'10.0.11');
END;

COMMIT;
GO

