-- HISTORICAL: follow this migration with 20261110-simplify-users.sql; current code uses existing Users columns.
BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [DirectoryLevelOverride] nvarchar(32) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [DirectoryRoleManaged] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [DirectorySourceRole] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [DisplayNameOptionId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [LastSyncedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD [TokenVersion] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    CREATE TABLE [DisplayNameOptions] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(160) NOT NULL,
        [NormalizedName] nvarchar(160) NOT NULL,
        CONSTRAINT [PK_DisplayNameOptions] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    CREATE TABLE [UserSyncLevelMappings] (
        [Id] int NOT NULL IDENTITY,
        [SourceRole] nvarchar(100) NOT NULL,
        [NormalizedSourceRole] nvarchar(100) NOT NULL,
        [Level] nvarchar(32) NOT NULL,
        CONSTRAINT [PK_UserSyncLevelMappings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Name', N'NormalizedName') AND [object_id] = OBJECT_ID(N'[DisplayNameOptions]'))
        SET IDENTITY_INSERT [DisplayNameOptions] ON;
    EXEC(N'INSERT INTO [DisplayNameOptions] ([Id], [Name], [NormalizedName])
    VALUES (1, N''Sales Administrative'', N''SALES ADMINISTRATIVE''),
    (2, N''Human Resources Staff'', N''HUMAN RESOURCES STAFF'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Name', N'NormalizedName') AND [object_id] = OBJECT_ID(N'[DisplayNameOptions]'))
        SET IDENTITY_INSERT [DisplayNameOptions] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    CREATE INDEX [IX_Users_DisplayNameOptionId] ON [Users] ([DisplayNameOptionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DisplayNameOptions_NormalizedName] ON [DisplayNameOptions] ([NormalizedName]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    CREATE UNIQUE INDEX [IX_UserSyncLevelMappings_NormalizedSourceRole] ON [UserSyncLevelMappings] ([NormalizedSourceRole]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_DisplayNameOptions_DisplayNameOptionId] FOREIGN KEY ([DisplayNameOptionId]) REFERENCES [DisplayNameOptions] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110120000_UserDirectoryManagement'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110120000_UserDirectoryManagement', N'10.0.11');
END;

COMMIT;
GO

