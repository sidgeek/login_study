# Prisma 数据库迁移指南

本文档介绍了如何在 `server_koa` 项目中使用 Prisma 进行数据库迁移和管理。

## 常用命令

我们在 `package.json` 中封装了常用的 Prisma 命令，方便快速调用：

| npm 命令 | 对应 Prisma 命令 | 说明 |
| :--- | :--- | :--- |
| `npm run db:migrate` | `npx prisma migrate dev` | **开发常用**：生成新的迁移文件并应用到开发数据库，同时更新 Client。 |
| `npm run db:generate` | `npx prisma generate` | 仅重新生成 Prisma Client 代码（不修改数据库）。 |
| `npm run db:push` | `npx prisma db push` | 直接将 Schema 变更推送到数据库（不生成迁移文件），适用于快速原型开发。 |
| `npm run db:pull` | `npx prisma db pull` | 从现有数据库反向生成 `schema.prisma` 文件。 |
| `npm run db:studio` | `npx prisma studio` | 打开浏览器端的图形化数据库管理界面。 |

## 开发流程：如何修改数据库结构

当你需要修改数据库表结构（例如添加新表、修改字段）时，请遵循以下步骤：

### 1. 修改 Schema 文件

编辑 `server_koa/prisma/schema.prisma` 文件，进行你需要的更改。

例如，添加一个新的 `Post` 模型：

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String   @db.VarChar(255)
  content   String?
  published Boolean  @default(false)
  authorId  BigInt
  author    User     @relation(fields: [authorId], references: [id])
}
```

### 2. 生成并应用迁移 (Migration)

运行以下命令来生成 SQL 迁移文件并应用到数据库：

```bash
# 格式：npm run db:migrate -- --name <本次修改的描述>
npm run db:migrate -- --name add_post_model
```

**命令执行过程：**
1.  Prisma 会检测 schema 变更。
2.  在 `prisma/migrations` 目录下生成一个新的文件夹（例如 `20251227100000_add_post_model`），里面包含 `migration.sql`。
3.  自动在连接的 PostgreSQL 数据库中执行该 SQL。
4.  自动运行 `prisma generate`，更新 `node_modules` 中的 Client 代码，使你可以在代码中立即使用 `prisma.post.findMany()`。

### 3. 提交代码

请务必将 `prisma/migrations` 目录下的所有新文件提交到 Git 版本控制中。这保证了团队其他成员和生产环境可以通过应用这些 SQL 文件来同步数据库结构。

## 其他场景

### 仅更新 Client 代码

如果你没有修改 `schema.prisma`，或者只是拉取了别人的代码（其中包含新的迁移文件），你需要更新本地的 Client 定义：

```bash
npm run db:generate
```

### 查看和管理数据

如果你想直观地查看、添加或编辑数据库中的数据：

```bash
npm run db:studio
```

这将自动打开浏览器访问 `http://localhost:5555`。
