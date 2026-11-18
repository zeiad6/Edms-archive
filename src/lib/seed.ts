import { db, dbReady, client, applyConnectionPragmas } from "@/db";
import {
  departments,
  users,
  folders,
  tags,
  docTypes,
  documents,
  documentTags,
  documentVersions,
  auditLogs,
  approvalRequests,
} from "@/db/schema";
import { ensureStorage, writeKey, genKey } from "@/lib/server";
import { makeScanSvg } from "@/lib/doc-svg";
import { hashPassword, seedPassword } from "@/lib/password";
import { APP_VERSION } from "@/lib/version";
import {
  TARGET_SCHEMA_VERSION,
  compareSemver,
  createPreUpgradeSnapshot,
  getSchemaUserVersion,
  readRecordedAppVersion,
  rollbackFromPreUpgradeSnapshot,
  verifyDatabaseIntegrity,
  writeRecordedAppVersion,
} from "@/lib/upgrade-engine";
import { sql } from "drizzle-orm";

let running: Promise<void> | null = null;

interface DocSpec {
  title: string;
  docNumber: string;
  docType: string;
  status: "active" | "pending_review" | "archived" | "draft";
  confidential?: boolean;
  dept: number;
  folder: number;
  uploader: number;
  daysAgo: number;
  tags: number[];
  kind: "memo" | "invoice" | "contract" | "letter" | "report";
  body: string[];
  ocr: string;
  asPdf?: boolean;
}

function buildPdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const parts = ["BT", "/F1 22 Tf", "60 770 Td", "26 TL", `(${esc(title)}) Tj`];
  for (const l of lines) parts.push("T*", "/F1 13 Tf", `(${esc(l)}) Tj`);
  parts.push("ET");
  const contentStr = parts.join("\n");
  const objs: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(contentStr, "latin1")} >>\nstream\n${contentStr}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00F3\n";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(body, "latin1");
    body += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body + xref + trailer, "latin1");
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_en TEXT, code TEXT, description TEXT, color TEXT NOT NULL DEFAULT '#4f46e5', created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT, must_change_password INTEGER NOT NULL DEFAULT 0, job_title TEXT, role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','manager','staff')), department_id INTEGER REFERENCES departments(id), avatar_color TEXT NOT NULL DEFAULT '#4f46e5', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, parent_id INTEGER, department_id INTEGER REFERENCES departments(id), description TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS folders_parent_idx ON folders(parent_id)`,
  `CREATE INDEX IF NOT EXISTS folders_dept_idx ON folders(department_id)`,
  `CREATE INDEX IF NOT EXISTS users_dept_idx ON users(department_id)`,
  `CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL DEFAULT '#64748b')`,
  `CREATE TABLE IF NOT EXISTS doc_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, name_en TEXT, color TEXT NOT NULL DEFAULT '#64748b', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS doc_types_sort_idx ON doc_types(sort_order)`,
  `CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, doc_number TEXT, doc_type TEXT, doc_type_id INTEGER REFERENCES doc_types(id), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','pending_review','active','archived')), confidential INTEGER NOT NULL DEFAULT 0, storage_key TEXT NOT NULL, thumb_key TEXT, original_name TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, file_ext TEXT, file_size INTEGER NOT NULL, page_count INTEGER DEFAULT 1, content_text TEXT, ocr_text TEXT, ocr_processed INTEGER NOT NULL DEFAULT 0, department_id INTEGER REFERENCES departments(id), folder_id INTEGER REFERENCES folders(id), version INTEGER NOT NULL DEFAULT 1, doc_date TEXT, keywords TEXT, source TEXT, notes TEXT, uploaded_by_id INTEGER NOT NULL REFERENCES users(id), deleted_at TEXT, deleted_by_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS documents_dept_idx ON documents(department_id)`,
  `CREATE INDEX IF NOT EXISTS documents_folder_idx ON documents(folder_id)`,
  `CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status)`,
  `CREATE INDEX IF NOT EXISTS documents_uploader_idx ON documents(uploaded_by_id)`,
  `CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at)`,
  `CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents(updated_at)`,
  `CREATE INDEX IF NOT EXISTS documents_doc_date_idx ON documents(doc_date)`,
  `CREATE TABLE IF NOT EXISTS document_tags (document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (document_id, tag_id))`,
  `CREATE INDEX IF NOT EXISTS doctags_tag_idx ON document_tags(tag_id)`,
  `CREATE TABLE IF NOT EXISTS document_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, version INTEGER NOT NULL, storage_key TEXT NOT NULL, original_name TEXT NOT NULL, file_size INTEGER NOT NULL, note TEXT, uploaded_by_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS versions_doc_idx ON document_versions(document_id)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), user_name TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs(created_at)`,
  `CREATE TABLE IF NOT EXISTS approval_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, requested_by_id INTEGER NOT NULL REFERENCES users(id), assigned_to_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), comment TEXT, response_note TEXT, responded_at TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS approval_doc_idx ON approval_requests(document_id)`,
  `CREATE INDEX IF NOT EXISTS approval_assigned_idx ON approval_requests(assigned_to_id)`,
  `CREATE INDEX IF NOT EXISTS approval_status_idx ON approval_requests(status)`,
  `CREATE INDEX IF NOT EXISTS approval_created_at_idx ON approval_requests(created_at)`,
  `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN ('approval_requested','approval_approved','approval_rejected')), title TEXT NOT NULL, message TEXT NOT NULL, document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL, reference_id INTEGER, read_at TEXT, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id)`,
  `CREATE INDEX IF NOT EXISTS notif_read_idx ON notifications(user_id, read_at)`,
  `CREATE INDEX IF NOT EXISTS notif_created_at_idx ON notifications(created_at)`,
  `CREATE TABLE IF NOT EXISTS signatures (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), label TEXT DEFAULT 'توقيع', data_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS sig_doc_idx ON signatures(document_id)`,
  `CREATE INDEX IF NOT EXISTS sig_user_idx ON signatures(user_id)`,
  `CREATE TABLE IF NOT EXISTS document_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, title_pattern TEXT NOT NULL DEFAULT '{{title}}', department_id INTEGER REFERENCES departments(id), folder_id INTEGER REFERENCES folders(id), doc_type TEXT, default_tags TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','archived')), sort_order INTEGER NOT NULL DEFAULT 0, created_by_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  `CREATE INDEX IF NOT EXISTS templates_status_idx ON document_templates(status)`,
  `CREATE INDEX IF NOT EXISTS templates_sort_idx ON document_templates(sort_order)`,
];

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const rows = (await db.all(sql.raw(`PRAGMA table_info("${tableName}")`))) as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

interface NumberedMigration {
  version: number;
  description: string;
  up: () => Promise<void>;
}

const MIGRATIONS: NumberedMigration[] = [
  {
    version: 1,
    description: "Base schema DDL + users authentication columns (password_hash, must_change_password, username)",
    up: async () => {
      for (const stmt of DDL) {
        await client.execute(stmt);
      }
      const userCols = await getTableColumns("users");
      if (!userCols.has("password_hash")) {
        await client.execute("ALTER TABLE users ADD COLUMN password_hash TEXT");
      }
      if (!userCols.has("must_change_password")) {
        await client.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
      }
      if (!userCols.has("username")) {
        await client.execute("ALTER TABLE users ADD COLUMN username TEXT");
      }
      await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username)");
      await client.execute(
        "UPDATE users SET username = substr(email, 1, instr(email, '@') - 1) WHERE username IS NULL AND email LIKE '%@%'",
      );
      await client.execute(
        "UPDATE users SET username = 'user_' || id WHERE username IS NULL OR trim(username) = ''",
      );
    },
  },
  {
    version: 2,
    description: "Additive documents soft-delete and metadata columns (deleted_at, deleted_by_id, keywords, source, notes, doc_type, doc_type_id)",
    up: async () => {
      const docCols = await getTableColumns("documents");
      if (!docCols.has("doc_type")) {
        await client.execute("ALTER TABLE documents ADD COLUMN doc_type TEXT");
      }
      if (!docCols.has("doc_type_id")) {
        await client.execute("ALTER TABLE documents ADD COLUMN doc_type_id INTEGER REFERENCES doc_types(id)");
      }
      if (!docCols.has("deleted_at")) {
        await client.execute("ALTER TABLE documents ADD COLUMN deleted_at TEXT");
      }
      if (!docCols.has("deleted_by_id")) {
        await client.execute("ALTER TABLE documents ADD COLUMN deleted_by_id INTEGER REFERENCES users(id)");
      }
      if (!docCols.has("keywords")) {
        await client.execute("ALTER TABLE documents ADD COLUMN keywords TEXT");
      }
      if (!docCols.has("source")) {
        await client.execute("ALTER TABLE documents ADD COLUMN source TEXT");
      }
      if (!docCols.has("notes")) {
        await client.execute("ALTER TABLE documents ADD COLUMN notes TEXT");
      }
      await client.execute("CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON documents(deleted_at)");
      await client.execute("CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(doc_type)");
      await client.execute("CREATE INDEX IF NOT EXISTS documents_doc_type_id_idx ON documents(doc_type_id)");
    },
  },
  {
    version: 3,
    description: "Additive documents.ocr_text column + repair literal CURRENT_TIMESTAMP defaults + backfill doc_type_id",
    up: async () => {
      const docCols = await getTableColumns("documents");
      if (!docCols.has("ocr_text")) {
        await client.execute("ALTER TABLE documents ADD COLUMN ocr_text TEXT");
      }

      // Repair any legacy rows where literal string 'CURRENT_TIMESTAMP' was stored
      const tablesWithCreatedAt = [
        "departments",
        "users",
        "folders",
        "doc_types",
        "documents",
        "document_versions",
        "audit_logs",
        "approval_requests",
        "notifications",
        "signatures",
        "document_templates",
      ];
      for (const tbl of tablesWithCreatedAt) {
        await client.execute(
          `UPDATE "${tbl}" SET created_at = datetime('now') WHERE created_at = 'CURRENT_TIMESTAMP'`,
        );
      }
      const tablesWithUpdatedAt = ["documents", "approval_requests", "document_templates"];
      for (const tbl of tablesWithUpdatedAt) {
        await client.execute(
          `UPDATE "${tbl}" SET updated_at = COALESCE(NULLIF(created_at, 'CURRENT_TIMESTAMP'), datetime('now')) WHERE updated_at = 'CURRENT_TIMESTAMP'`,
        );
      }

      // Backfill doc_type_id for documents created before doc_types existed
      await client.execute(`
        UPDATE documents
        SET doc_type_id = (SELECT id FROM doc_types WHERE doc_types.name = documents.doc_type)
        WHERE doc_type_id IS NULL AND doc_type IS NOT NULL
          AND EXISTS (SELECT 1 FROM doc_types WHERE doc_types.name = documents.doc_type)
      `);
    },
  },
];

export async function ensureSchema(): Promise<void> {
  await dbReady;

  const existingTables = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )) as Array<{ name: string }>;
  const hasExistingData = existingTables.some((t) => t.name === "users" || t.name === "documents");

  const currentSchemaVersion = await getSchemaUserVersion();
  const recordedApp = await readRecordedAppVersion();
  const isVersionUpgrade =
    hasExistingData &&
    ((recordedApp !== null && compareSemver(APP_VERSION, recordedApp.version) > 0) ||
      currentSchemaVersion < TARGET_SCHEMA_VERSION);

  let snapshotPath: string | null = null;

  if (hasExistingData) {
    // Pre-migration integrity check
    await verifyDatabaseIntegrity({ enforceForeignKeys: false });
  }

  if (isVersionUpgrade) {
    snapshotPath = await createPreUpgradeSnapshot(recordedApp?.version ?? `schema-v${currentSchemaVersion}`);
  }

  try {
    // Ensure base tables always exist even if user_version was already set
    if (!hasExistingData && currentSchemaVersion >= TARGET_SCHEMA_VERSION) {
      for (const stmt of DDL) {
        await client.execute(stmt);
      }
      await client.execute("CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON documents(deleted_at)");
    }

    for (const migration of MIGRATIONS) {
      if (migration.version <= currentSchemaVersion && hasExistingData) continue;

      await client.execute("BEGIN IMMEDIATE");
      try {
        await migration.up();
        await client.execute(`PRAGMA user_version = ${migration.version}`);
        await client.execute("COMMIT");
      } catch (migErr) {
        try {
          await client.execute("ROLLBACK");
        } catch {
          /* ignore rollback error */
        }
        throw migErr;
      }
    }

    // Re-apply connection PRAGMAs and verify post-migration integrity
    await applyConnectionPragmas();
    await verifyDatabaseIntegrity({ enforceForeignKeys: true });

    if (
      !recordedApp ||
      recordedApp.version !== APP_VERSION ||
      recordedApp.schemaVersion !== TARGET_SCHEMA_VERSION
    ) {
      await writeRecordedAppVersion({
        version: APP_VERSION,
        schemaVersion: TARGET_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        lastSnapshot: snapshotPath ? snapshotPath.split(/[\\/]/).pop() ?? null : recordedApp?.lastSnapshot ?? null,
      });
    }
  } catch (err) {
    if (snapshotPath) {
      await rollbackFromPreUpgradeSnapshot(snapshotPath);
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      snapshotPath
        ? `فشل ترحيل قاعدة البيانات وتمت استعادة النسخة الاحتياطية التلقائية بنجاح: ${reason}`
        : `فشل تهيئة أو ترحيل مخطط قاعدة البيانات: ${reason}`,
    );
  }
}

/**
 * Give every user without a stored hash a password and force a change on next
 * login. Runs twice: once for pre-existing databases (before the early-return
 * user count check) and once after the fresh-seed user insert — otherwise
 * freshly seeded users would end up with `password_hash = NULL` and no one
 * could authenticate (login and the demo picker both reject NULL).
 *
 * The password comes from `seedPassword()`: the documented DEFAULT_PASSWORD,
 * always paired with `must_change_password = 1`.
 */
async function backfillPasswords(): Promise<void> {
  try {
    const missing = (await db.all(
      sql`SELECT id FROM users WHERE password_hash IS NULL LIMIT 1`,
    )) as Array<{ id: number }>;
    if (missing.length === 0) return;

    const { password, disclose } = seedPassword();
    const pwHash = await hashPassword(password);
    await db.run(sql`UPDATE users SET password_hash = ${pwHash}, must_change_password = 1 WHERE password_hash IS NULL`);
    if (disclose) {
      // One-time disclosure: this is the only chance to learn the seeded
      // credentials. `must_change_password = 1` still forces a change before
      // the account is usable, and every login route enforces that flag.
      console.log(
        `[seed] backfilled accounts with the generated password: ${password} ` +
          "(change it on first login)"
      );
    }
  } catch (e) {
    console.error("[seed] password backfill failed:", e);
  }
}

async function doSeed(): Promise<void> {
  // The DDL and the migrations below rely on foreign-key enforcement, so the
  // connection must be configured before the first statement.
  await dbReady;
  await ensureSchema();
  await ensureStorage();

  // Backfill password hashes for users created before password auth existed.
  // `backfillPasswords` arms must_change_password on every account it touches,
  // so nobody keeps access through a seeded password.
  await backfillPasswords();

  const [countRes] = await db
    .select({ c: sql<number>`CAST(count(*) AS INTEGER)` })
    .from(users);
  const userCount = countRes?.c ?? 0;
  if (userCount > 0) return;

  // Departments - insert then re-select to get deterministic IDs
  await db.insert(departments).values([
    { name: "الإدارة العامة", code: "GEN", color: "#4f46e5", description: "الإدارة العليا والأمانة العامة" },
    { name: "الشؤون المالية", code: "FIN", color: "#059669", description: "الميزانية والحسابات والمدفوعات" },
    { name: "الموارد البشرية", code: "HR", color: "#d97706", description: "شؤون الموظفين والتوظيف" },
    { name: "تقنية المعلومات", code: "IT", color: "#0ea5e9", description: "الأنظمة والبنية التحتية الرقمية" },
    { name: "الشؤون القانونية", code: "LEG", color: "#be123c", description: "الاستشارات والمراجعة القانونية" },
    { name: "العقود والمشتريات", code: "PROC", color: "#7c3aed", description: "المناقصات وإدارة العقود" },
  ]);
  const deptRows = await db.select({ id: departments.id }).from(departments).orderBy(departments.id).limit(6);
  const deptIds = deptRows.map(r => r.id);
  const deptId = (i: number) => deptIds[i] ?? deptIds[0];

  // Users — administrator only.
  //
  // A fresh install ships exactly ONE account. The earlier seed created six
  // demo personas (two managers, three staff), all sharing the published
  // DEFAULT_PASSWORD, which meant every deployment exposed five extra
  // credentials for roles whose only purpose was to look populated on the
  // login screen. The demo personas are gone; departments, folders, tags,
  // document types and templates still seed, so the UI is not empty — the
  // administrator creates real accounts from Settings → Users.
  await db.insert(users).values([
    { name: "ZeidexSoft", username: "admin", email: "z30432981@gmail.com", jobTitle: "المدير العام", role: "admin", departmentId: deptId(0), avatarColor: "#4f46e5" },
  ]);
  const userRows = await db.select({ id: users.id, name: users.name }).from(users).orderBy(users.id).limit(1);
  const adminId = userRows[0]?.id ?? 1;
  const adminName = userRows[0]?.name ?? "ZeidexSoft";
  /**
   * Every seeded document is attributed to the single administrator account.
   * The data set keeps its `uploader` index so the spread of departments and
   * types stays visible, but the index is not a user id any more — there is
   * only one user to attribute to.
   */
  const uid = (_i: number) => adminId;

  // Fresh-seed users were inserted without a hash — apply the default-password
  // backfill now so password login (and the demo picker) work on a new DB.
  await backfillPasswords();

  // Folders
  await db.insert(folders).values([
    { name: "المراسلات الصادرة", departmentId: deptId(0) },
    { name: "المراسلات الواردة", departmentId: deptId(0) },
    { name: "القرارات الإدارية", departmentId: deptId(0) },
    { name: "الفواتير والمدفوعات", departmentId: deptId(1) },
    { name: "ملفات الموظفين", departmentId: deptId(2) },
    { name: "تقارير المشاريع", departmentId: deptId(3) },
    { name: "الوثائق القانونية", departmentId: deptId(4) },
    { name: "العقود", departmentId: deptId(5) },
    { name: "عقود الموردين", departmentId: deptId(5) },
    { name: "عقود التوظيف", departmentId: deptId(5) },
  ]);
  const folderRows = await db.select({ id: folders.id }).from(folders).orderBy(folders.id).limit(10);
  const fid = (i: number) => folderRows[i]?.id ?? folderRows[0]?.id ?? 1;

  // Tags
  await db.insert(tags).values([
    { name: "عاجل", color: "#dc2626" },
    { name: "سري", color: "#7c3aed" },
    { name: "موقّع", color: "#059669" },
    { name: "قيد المراجعة", color: "#d97706" },
    { name: "مؤرشف", color: "#0ea5e9" },
    { name: "نسخة طبق الأصل", color: "#64748b" },
  ]);
  const tagRows = await db.select({ id: tags.id }).from(tags).orderBy(tags.id).limit(6);
  const tid = (i: number) => tagRows[i]?.id ?? tagRows[0]?.id ?? 1;

  // Document types - insert then map name -> id for docTypeId lookups
  await db.insert(docTypes).values([
    { name: "قرار إداري", nameEn: "Administrative Decision", color: "#4f46e5", sortOrder: 1 },
    { name: "فاتورة", nameEn: "Invoice", color: "#059669", sortOrder: 2 },
    { name: "عقد", nameEn: "Contract", color: "#7c3aed", sortOrder: 3 },
    { name: "محضر اجتماع", nameEn: "Meeting Minutes", color: "#d97706", sortOrder: 4 },
    { name: "تقرير", nameEn: "Report", color: "#0ea5e9", sortOrder: 5 },
    { name: "مراسلة رسمية", nameEn: "Official Correspondence", color: "#dc2626", sortOrder: 6 },
    { name: "نموذج", nameEn: "Form", color: "#64748b", sortOrder: 7 },
    { name: "صورة ضوئية", nameEn: "Scan", color: "#0891b2", sortOrder: 8 },
  ]);
  const typeRows = await db.select({ id: docTypes.id, name: docTypes.name }).from(docTypes);
  const typeId = new Map(typeRows.map(r => [r.name, r.id]));

  const specs: DocSpec[] = [
    {
      title: "قرار بتعديل الهيكل التنظيمي",
      docNumber: "ق-٢٠٢٤/١٠٢",
      docType: "قرار إداري",
      status: "active",
      dept: 0,
      folder: 2,
      uploader: 0,
      daysAgo: 2,
      tags: [2, 0],
      kind: "memo",
      confidential: true,
      body: [
        "بناءً على الصلاحيات المخوّلة، تقرر إعادة هيكلة الإدارات الفنية وتوحيد مهام الأقسام التشغيلية لرفع الكفاءة المؤسسية.",
        "يسري هذا القرار اعتباراً من بداية السنة المالية القادمة، وعلى جميع الإدارات المعنية الالتزام بمضمونه.",
      ],
      ocr: "قرار تعديل الهيكل التنظيمي للإدارة العامة وإعادة هيكلة الإدارات الفنية وتوحيد مهام الأقسام التشغيلية لرفع الكفاءة المؤسسية. يسري القرار من بداية السنة المالية. سري ومعتمد من المدير العام خالد العمري.",
    },
    {
      title: "فاتورة خدمات استشارية - الربع الأول",
      docNumber: "ف-٢٠٢٤/٠٤٥١",
      docType: "فاتورة",
      status: "active",
      dept: 1,
      folder: 3,
      uploader: 1,
      daysAgo: 5,
      tags: [2],
      kind: "invoice",
      body: [
        "فاتورة مقدمة من شركة الحلول المتقدمة لتقنية المعلومات مقابل خدمات استشارية وترخيص برمجي وصيانة دورية.",
        "الإجمالي: ثلاثة وعشرون ألفاً وخمسمائة ريال شامل ضريبة القيمة المضافة.",
      ],
      ocr: "فاتورة خدمات استشارية شركة الحلول المتقدمة ترخيص برمجي صيانة دورية الإجمالي 23500 ريال ضريبة القيمة المضافة معتمدة من الشؤون المالية سارة المالكي.",
    },
    {
      title: "عقد توريد أجهزة حاسب آلي",
      docNumber: "ع-٢٠٢٤/٠٠٧٨",
      docType: "عقد",
      status: "active",
      dept: 5,
      folder: 8,
      uploader: 0,
      daysAgo: 12,
      tags: [2],
      kind: "contract",
      body: [
        "اتفاقية توريد مئة وخمسين جهاز حاسب آلي محمول مع الضمان والصيانة لمدة ثلاث سنوات وتسليم على ثلاث دفعات.",
        "القيمة الإجمالية أربعمائة وخمسون ألف ريال، ويُلغى العقد عند الإخلال بالشروط بعد إنذار خطي.",
      ],
      ocr: "عقد توريد أجهزة حاسب آلي مئة وخمسون جهازا محمولا ضمان ثلاث سنوات تسليم ثلاث دفعات القيمة 450000 ريال إلغاء عند الإخلال بشروط التسليم موقّع من الطرفين.",
    },
    {
      title: "محضر اجتماع اللجنة التوجيهية",
      docNumber: "م-٢٠٢٤/٠١١",
      docType: "محضر اجتماع",
      status: "active",
      dept: 0,
      folder: 0,
      uploader: 5,
      daysAgo: 7,
      tags: [3],
      kind: "memo",
      body: [
        "عقدت اللجنة التوجيهية اجتماعها الدوري بحضور جميع الأعضاء، ونوقشت خطة التحول الرقمي وميزانية الربع القادم.",
        "تم الاتفاق على اعتماد منصة الأرشفة الإلكترونية الجديدة وربطها بنظام الموارد البشرية خلال ستين يوماً.",
      ],
      ocr: "محضر اجتماع اللجنة التوجيهية حضور كامل الأعضاء مناقشة خطة التحول الرقمي وميزانية الربع اعتماد منصة الأرشفة الإلكترونية وربطها بنظام الموارد البشرية خلال ستين يوما.",
    },
    {
      title: "تقرير حالة مشروع الأرشفة الإلكترونية",
      docNumber: "ت-٢٠٢٤/٠٠٣٤",
      docType: "تقرير",
      status: "pending_review",
      dept: 3,
      folder: 5,
      uploader: 2,
      daysAgo: 9,
      tags: [3],
      kind: "report",
      body: [
        "يستعرض التقرير نسبة الإنجاز في مشروع الأرشفة الإلكترونية والتي بلغت 72 بالمئة مع رقمنة أكثر من خمسة وأربعين ألف وثيقة.",
        "التوصية: تعزيز فريق الفهرسة واعتماد محرك البحث المتكامل مع نظام التحقق من الصلاحيات قبل الإطلاق التجريبي.",
      ],
      ocr: "تقرير مشروع الأرشفة الإلكترونية نسبة الإنجاز 72 بالمئة رقمنة خمسة وأربعين ألف وثيقة توصية تعزيز فريق الفهرسة اعتماد محرك البحث والتحقق من الصلاحيات قبل الإطلاق التجريبي.",
    },
    {
      title: "خطاب تعميم سياسة الحوكمة الرقمية",
      docNumber: "خ-٢٠٢٤/٢٣٠",
      docType: "مراسلة رسمية",
      status: "active",
      dept: 0,
      folder: 0,
      uploader: 5,
      daysAgo: 15,
      tags: [0],
      kind: "letter",
      body: [
        "يهدف هذا التعميم إلى تطبيق سياسة الحوكمة الرقمية وحماية البيانات وضبط الصلاحيات على جميع الأنظمة الإلكترونية.",
        "يُرجى من جميع الإدارات حصر المستخدمين وتحديث صلاحيات الوصول وفق مبدأ الحد الأدنى من الامتيازات.",
      ],
      ocr: "تعميم سياسة الحوكمة الرقمية حماية البيانات ضبط الصلاحيات حصر المستخدمين تحديث صلاحيات الوصول مبدأ الحد الأدنى من الامتيازات عاجل.",
    },
    {
      title: "طلب توظيف مهندس أنظمة",
      docNumber: "ت-٢٠٢٤/١١٨",
      docType: "نموذج",
      status: "pending_review",
      dept: 2,
      folder: 4,
      uploader: 3,
      daysAgo: 18,
      tags: [3],
      kind: "memo",
      body: [
        "طلب اعتماد شاغر وظيفي لمهندس أنظمة سحابية ضمن فريق تقنية المعلومات بدرجة سادسة.",
        "المؤهلات المطلوبة: خبرة خمس سنوات في البنية السحابية وأمن المعلومات وشهادات معتمدة.",
      ],
      ocr: "طلب توظيف مهندس أنظمة سحابية فريق تقنية المعلومات درجة سادسة خبرة خمس سنوات البنية السحابية أمن المعلومات شهادات معتمدة قيد المراجعة.",
    },
    {
      title: "مذكرة قانونية بشأن تجديد العقود",
      docNumber: "ق-٢٠٢٤/٠٥٦",
      docType: "مراسلة رسمية",
      status: "active",
      confidential: true,
      dept: 4,
      folder: 6,
      uploader: 4,
      daysAgo: 21,
      tags: [1, 2],
      kind: "letter",
      body: [
        "بعد الاطلاع على عقود الموردين المنتهية خلال الستين يوماً القادمة، نوصي بمراجعة شروط التجديد والتزامات الأطراف.",
        "يرجى عدم تجديد أي عقد قبل مراجعة الإدارة القانونية والتأكد من سريان التأمين والضمانات.",
      ],
      ocr: "مذكرة قانونية تجديد العقود الموردين المنتهية ستون يوما مراجعة شروط التجديد والتزامات الأطراف عدم التجديد قبل مراجعة الإدارة القانونية سري التأمين والضمانات.",
    },
    {
      title: "تقرير الأداء المالي للنصف الأول",
      docNumber: "ت-٢٠٢٤/٠٠٧",
      docType: "تقرير",
      status: "active",
      dept: 1,
      folder: 3,
      uploader: 1,
      daysAgo: 30,
      tags: [4],
      kind: "report",
      body: [
        "بلغت المصروفات التشغيلية في النصف الأول من العام 58% من الميزانية المعتمدة مع انضباط ملحوظ في الصرف.",
        "الإيرادات المحققة تجاوزت المستهدف بنسبة 12% بفضل تطوير خدمات التحصيل الإلكتروني.",
      ],
      ocr: "تقرير الأداء المالي النصف الأول المصروفات التشغيلية 58 بالمئة من الميزانية انضباط في الصرف الإيرادات تجاوزت المستهدف 12 بالمئة التحصيل الإلكتروني.",
      asPdf: true,
    },
    {
      title: "محاضر تسليم ومقالة مخازن",
      docNumber: "ع-٢٠٢٣/٠٢٢٠",
      docType: "عقد",
      status: "archived",
      dept: 5,
      folder: 9,
      uploader: 0,
      daysAgo: 120,
      tags: [4, 5],
      kind: "contract",
      body: [
        "وثيقة أرشيفية لتسليم مخازن المعدات القديمة وإخلاء طرف بعد انتهاء عقد الصيانة السنوي للعام الماضي.",
        "تم إيداع المستند في الأرشيف المركزي ضمن سجلات العقود المنتهية لغايات المراجعة وال audit.",
      ],
      ocr: "محاضر تسليم ومقالة مخازن المعدات القديمة إخلاء طرف انتهاء عقد الصيانة السنوي أرشيف مركزي سجلات العقود المنتهية مراجعة تدقيق مؤرشف نسخة طبق الأصل.",
      asPdf: true,
    },
    {
      title: "صورة ضوئية لبطاقة منشأة",
      docNumber: "ص-٢٠٢٤/٠٠٩",
      docType: "صورة ضوئية",
      status: "active",
      dept: 0,
      folder: 1,
      uploader: 5,
      daysAgo: 40,
      tags: [5],
      kind: "memo",
      body: [
        "نسخة ممسوحة ضوئياً من وثيقة رسمية مرفقة مع ملف المنشأة لأغراض المطابقة والتحقق.",
        "تمت معالجة الصورة عبر محرك OCR واستخراج نصها وفهرسته في محرك البحث.",
      ],
      ocr: "نسخة ممسوحة ضوئيا وثيقة رسمية مرفقة ملف المنشأة مطابقة وتحقق معالجة OCR استخراج النص فهرسة محرك البحث نسخة طبق الأصل.",
    },
    {
      title: "خطاب شكر وتقدير",
      docNumber: "خ-٢٠٢٤/٣٠١",
      docType: "مراسلة رسمية",
      status: "active",
      dept: 0,
      folder: 0,
      uploader: 0,
      daysAgo: 3,
      tags: [2],
      kind: "letter",
      body: [
        "يتقدم المدير العام بخالص الشكر والتقدير للفريق المنفذ لمشروع الأرشفة الإلكترونية على جهوده المتميزة.",
        "نسأل الله لكم دوام التوفيق والنجاح في المهام القادمة.",
      ],
      ocr: "خطاب شكر وتقدير المدير العام الفريق المنفذ مشروع الأرشفة الإلكترونية جهود متميزة توفيق ونجاح.",
    },
  ];

  const deptByIdx = (i: number) => deptIds[i] ?? deptIds[0];

  for (const s of specs) {
    let buf: Buffer;
    let mime: string;
    let ext: string;
    let thumb: string | null;
    if (s.asPdf) {
      buf = buildPdf(s.title, s.body);
      mime = "application/pdf";
      ext = "pdf";
      thumb = null;
    } else {
      const svg = makeScanSvg({
        title: s.title,
        docNumber: s.docNumber,
        department: ["الإدارة العامة", "الشؤون المالية", "الموارد البشرية", "تقنية المعلومات", "الشؤون القانونية", "العقود والمشتريات"][s.dept],
        kind: s.kind,
        body: s.body,
      });
      buf = Buffer.from(svg, "utf-8");
      mime = "image/svg+xml";
      ext = "svg";
      thumb = null; // svg key reused as thumbnail via file route
    }
    const key = genKey(ext);
    try {
      await writeKey(key, buf);
    } catch (e) {
      console.error("[seed] writeKey failed:", e);
      continue;
    }
    const created = new Date(Date.now() - s.daysAgo * 86400000);
    const [doc] = await db
      .insert(documents)
      .values({
        title: s.title,
        description: s.body[0],
        docNumber: s.docNumber,
        docType: s.docType,
        docTypeId: typeId.get(s.docType) ?? null,
        status: s.status,
        confidential: s.confidential ? 1 : 0,
        storageKey: key,
        thumbKey: thumb ?? (mime === "image/svg+xml" ? key : null),
        originalName: `${s.docNumber} - ${s.title}.${ext}`,
        fileName: key.split("/").pop()!,
        mimeType: mime,
        fileExt: ext,
        fileSize: buf.length,
        pageCount: 1,
        contentText: s.ocr,
        ocrProcessed: 1,
        departmentId: deptByIdx(s.dept),
        folderId: fid(s.folder),
        version: 1,
        docDate: created.toISOString().slice(0, 10),
        uploadedById: uid(s.uploader),
        createdAt: created.toISOString(),
        updatedAt: created.toISOString(),
      })
      .returning({ id: documents.id });

    const docId = doc?.id ?? 0;
    if (docId) {
      await db.insert(documentVersions).values({
        documentId: docId,
        version: 1,
        storageKey: key,
        originalName: `${s.docNumber} - ${s.title}.${ext}`,
        fileSize: buf.length,
        note: "النسخة الأصلية المودعة",
        uploadedById: uid(s.uploader),
        createdAt: created.toISOString(),
      });
      for (const t of s.tags) {
        try {
          await db.insert(documentTags).values({ documentId: docId, tagId: tid(t) });
        } catch (e) {
          /* ignore duplicate */
          console.error("[seed] tag insert failed:", e);
        }
      }
      await logAuditSafe({
        userId: uid(s.uploader),
        userName: adminName,
        action: "document.upload",
        entityType: "document",
        entityId: docId,
        details: `إيداع المستند: ${s.title}`,
        when: created,
      });
    }
  }

  // Approval requests
  try {
    const pendingDocs = await db
      .select({ id: documents.id, title: documents.title, uploadedById: documents.uploadedById })
      .from(documents)
      .limit(8);
    const allApprovers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`role != 'staff'`)
      .limit(4);
    if (pendingDocs.length > 1 && allApprovers.length > 0) {
      const today = new Date();
      const approvalSeeds = [
        { docIdx: 0, approverIdx: 0, status: "approved" as const, comment: "نرجو مراجعة قرار التعديل", responseNote: "تمت الموافقة بعد المراجعة", daysAgo: 1 },
        { docIdx: 1, approverIdx: 0, status: "pending" as const, comment: "الموافقة على صرف الفاتورة", daysAgo: 0 },
        { docIdx: 2, approverIdx: 1, status: "rejected" as const, comment: "طلب الموافقة على العقد", responseNote: "نقص في بنود الضمان، يُرجى التعديل", daysAgo: 3 },
        { docIdx: 3, approverIdx: 0, status: "pending" as const, comment: "اعتماد محضر الاجتماع", daysAgo: 0 },
      ];
      for (const a of approvalSeeds) {
        const doc = pendingDocs[a.docIdx];
        const app = allApprovers[a.approverIdx % allApprovers.length];
        if (!doc || !app) continue;
        const respondedAt = a.status !== "pending" ? new Date(today.getTime() - a.daysAgo * 86400000).toISOString() : null;
        await db.insert(approvalRequests).values({
          documentId: doc.id,
          requestedById: doc.uploadedById,
          assignedToId: app.id,
          status: a.status,
          comment: a.comment,
          responseNote: a.responseNote ?? null,
          respondedAt: respondedAt,
          createdAt: new Date(today.getTime() - (a.daysAgo + 1) * 86400000).toISOString(),
          updatedAt: new Date(today.getTime() - a.daysAgo * 86400000).toISOString(),
        });
      }
      // extra audit log for approvals
      await logAuditSafe({
        action: "approval.submit",
        details: "إرسال طلبات موافقة آلية للبيانات التجريبية",
        when: new Date(),
      });
    }
  } catch (e) {
    /* approval seeds optional */
    console.error("[seed] approval seeds failed:", e);
  }

  // A few extra activity entries to enrich the timeline
  const extra: Array<[string, string, number]> = [
    ["auth.login", "تسجيل الدخول إلى النظام", 8],
    ["document.search", 'بحث عن كلمة "عقد توريد"', 6],
    ["document.view", "عرض مستند: فاتورة خدمات استشارية", 5],
    ["document.download", "تنزيل: محضر اجتماع اللجنة التوجيهية", 4],
    ["auth.login", "تسجيل الدخول إلى النظام", 1],
  ];
  for (const [action, details, d] of extra) {
    await logAuditSafe({
      action,
      details,
      when: new Date(Date.now() - d * 3600000),
    });
  }
}

async function logAuditSafe(entry: {
  userId?: number;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: string;
  when: Date;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      userName: entry.userName ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      createdAt: entry.when.toISOString(),
    });
  } catch (e) {
    console.error("[seed] logAuditSafe failed:", e);
  }
}

export function ensureSeeded(): Promise<void> {
  if (!running) {
    running = doSeed().catch((e) => {
      console.error("[seed] failed:", e);
      running = null;
      throw e;
    });
  }
  return running;
}
