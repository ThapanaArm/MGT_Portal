BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] bigint NOT NULL IDENTITY,
        [BatchId] uniqueidentifier NOT NULL,
        [OccurredAt] datetime2 NOT NULL,
        [ActorUserId] int NULL,
        [Actor] nvarchar(320) NOT NULL,
        [ApplicationId] int NULL,
        [ApplicationName] nvarchar(500) NULL,
        [EntityType] nvarchar(100) NOT NULL,
        [EntityId] nvarchar(320) NULL,
        [EntityKeyJson] nvarchar(max) NOT NULL,
        [EventName] nvarchar(100) NOT NULL,
        [Action] nvarchar(32) NOT NULL,
        [Result] nvarchar(32) NOT NULL,
        [PreviousStage] nvarchar(64) NULL,
        [NewStage] nvarchar(64) NULL,
        [ChangedFieldsJson] nvarchar(max) NOT NULL,
        [BeforeJson] nvarchar(max) NULL,
        [AfterJson] nvarchar(max) NULL,
        [RequestMethod] nvarchar(16) NULL,
        [RequestPath] nvarchar(2048) NULL,
        [CorrelationId] nvarchar(128) NULL,
        [StatusCode] int NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AuditLogs_Applications_ApplicationId] FOREIGN KEY ([ApplicationId]) REFERENCES [Applications] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_ActorUserId_OccurredAt] ON [AuditLogs] ([ActorUserId], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_ApplicationId_OccurredAt] ON [AuditLogs] ([ApplicationId], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_EventName_OccurredAt] ON [AuditLogs] ([EventName], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_OccurredAt] ON [AuditLogs] ([OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261110110000_CentralAuditLogs'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261110110000_CentralAuditLogs', N'10.0.11');
END;

COMMIT;
GO

