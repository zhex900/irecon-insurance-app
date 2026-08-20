# Legacy MSSQL setup (local)

Source database for `npm run db:migrate:legacy:*`. Connection uses `MSSQL_*` in `.env`.

## Docker (Apple Silicon)

```bash
docker run -d \
  --name mssql-arm \
  -e "ACCEPT_EULA=1" \
  -e "MSSQL_SA_PASSWORD=P@#123pass" \
  -p 1433:1433 \
  mcr.microsoft.com/azure-sql-edge
```

## Restore backup

Copy the `.bak` file into the container, then restore:

```bash
docker cp vs434253_1_backup_2026_08_19_010131_4644113.bak mssql-arm:/var/opt/mssql/data/

sqlcmd -S localhost,1433 -U sa -P "P@#123pass" -Q \
  "RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/data/vs434253_1_backup_2026_08_19_010131_4644113.bak'"

sqlcmd -S localhost,1433 -U sa -P "P@#123pass" -Q \
  "RESTORE DATABASE [vs434253_1] FROM DISK = '/var/opt/mssql/data/vs434253_1_backup_2026_08_19_010131_4644113.bak' WITH MOVE 'vs434253_1' TO '/var/opt/mssql/data/vs434253_1.mdf', MOVE 'vs434253_1_log' TO '/var/opt/mssql/data/vs434253_1_log.ldf', RECOVERY, REPLACE"

sqlcmd -S localhost,1433 -U sa -P "P@#123pass" -Q "SELECT name FROM sys.databases;"
```

## `.env` source connection

```env
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD="P@#123pass"
MSSQL_DATABASE=vs434253_1
```

Migration scripts always read MSSQL from `.env` regardless of `--env` (Postgres target).
