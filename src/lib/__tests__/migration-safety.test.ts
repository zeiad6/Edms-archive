// @vitest-environment node
import { describe, it, expect, vi, afterAll } from "vitest";
import { createClient } from "@libsql/client";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "edms-migration-v100-"));
const dataDir = path.join(root, "data");
const storageDir = path.join(root, "storage");
const dbFile = path.join(dataDir, "edms.db").replace(/\\/g, "/");

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

/**
 * Build an authentic v1.0.0 database (user_version = 0, pre-auth columns,
 * pre-soft-delete columns, pre-metadata columns, literal 'CURRENT_TIMESTAMP').
 */
async function createV100Database(): Promise<void> {
  mkdirSync(path.join(storageDir, "documents", "2025", "01"), { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  // Write pre-existing files (including .svg and uppercase .PDF extension)
  writeFileSync(
    path.join(storageDir, "documents", "2025", "01", "legacy-scan.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><text>وثيقة قديمة 1.0.0</text></svg>',
    "utf8",
  );
  writeFileSync(
    path.join(storageDir, "documents", "2025", "01", "UPPERCASE.PDF"),
    "%PDF-1.4\n%Legacy v1.0.0 PDF\n%%EOF",
    "utf8",
  );

  // Record v1.0.0 in app-version.json
  writeFileSync(
    path.join(dataDir, "app-version.json"),
    JSON.stringify({ version: "1.0.0", schemaVersion: 0, updatedAt: "2025-01-01T00:00:00.000Z" }),
    "utf8",
  );

  const rawClient = createClient({ url: `file:${dbFile}` });
  try {
    // Exact v1.0.0 tables (before username/password_hash/deleted_at/keywords/source/notes/ocr_text)
    await rawClient.execute(`
      CREATE TABLE departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        code TEXT,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#4f46e5',
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        job_title TEXT,
        role TEXT NOT NULL DEFAULT 'staff',
        department_id INTEGER REFERENCES departments(id),
        avatar_color TEXT NOT NULL DEFAULT '#4f46e5',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        department_id INTEGER REFERENCES departments(id),
        description TEXT,
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#64748b'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE doc_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        name_en TEXT,
        color TEXT NOT NULL DEFAULT '#64748b',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        doc_number TEXT,
        doc_type TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        confidential INTEGER NOT NULL DEFAULT 0,
        storage_key TEXT NOT NULL,
        thumb_key TEXT,
        original_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_ext TEXT,
        file_size INTEGER NOT NULL,
        page_count INTEGER DEFAULT 1,
        content_text TEXT,
        ocr_processed INTEGER NOT NULL DEFAULT 0,
        department_id INTEGER REFERENCES departments(id),
        folder_id INTEGER REFERENCES folders(id),
        version INTEGER NOT NULL DEFAULT 1,
        doc_date TEXT,
        uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
        updated_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);
    await rawClient.execute(`
      CREATE TABLE document_tags (
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, tag_id)
      )
    `);
    await rawClient.execute(`
      CREATE TABLE document_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        note TEXT,
        uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
      )
    `);

    // Populate v1.0.0 user data
    await rawClient.execute(
      `INSERT INTO departments (id, name, code, created_at) VALUES (1, 'الإدارة المالية', 'FIN', 'CURRENT_TIMESTAMP')`,
    );
    await rawClient.execute(
      `INSERT INTO users (id, name, email, role, department_id, created_at) VALUES
        (1, 'مدير النظام القديم', 'admin.legacy@edms.gov', 'admin', 1, 'CURRENT_TIMESTAMP'),
        (2, 'موظف الأرشيف', 'archivist@edms.gov', 'staff', 1, 'CURRENT_TIMESTAMP')`,
    );
    await rawClient.execute(
      `INSERT INTO folders (id, name, department_id, created_at) VALUES (1, 'عقود 2025', 1, 'CURRENT_TIMESTAMP')`,
    );
    await rawClient.execute(
      `INSERT INTO tags (id, name, color) VALUES (1, 'مهم جداً', '#dc2626'), (2, 'مالي', '#059669')`,
    );
    await rawClient.execute(
      `INSERT INTO doc_types (id, name, name_en) VALUES (1, 'عقد', 'Contract')`,
    );
    await rawClient.execute(
      `INSERT INTO documents (
        id, title, description, doc_number, doc_type, status, confidential,
        storage_key, original_name, file_name, mime_type, file_ext, file_size,
        content_text, ocr_processed, department_id, folder_id, uploaded_by_id,
        created_at, updated_at
      ) VALUES
      (
        10, 'وثيقة ممسوحة من الإصدار الأول', 'وصف تاريخي هام للمستند', 'ع-2025/001', 'عقد', 'active', 0,
        'documents/2025/01/legacy-scan.svg', 'legacy-scan.svg', 'legacy-scan.svg', 'image/svg+xml', 'svg', 85,
        'وصف تاريخي هام للمستند مخزن في content_text منذ الإصدار 1.0.0', 1, 1, 1, 1,
        'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'
      ),
      (
        11, 'ملف PDF بامتداد أحرف كبيرة', 'تقرير مالي قديم', 'م-2025/002', 'عقد', 'active', 1,
        'documents/2025/01/UPPERCASE.PDF', 'UPPERCASE.PDF', 'UPPERCASE.PDF', 'application/pdf', 'PDF', 36,
        'تقرير مالي قديم', 0, 1, 1, 2,
        'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'
      )`,
    );
    await rawClient.execute(
      `INSERT INTO document_tags (document_id, tag_id) VALUES (10, 1), (10, 2), (11, 2)`,
    );
    await rawClient.execute(
      `INSERT INTO document_versions (document_id, version, storage_key, original_name, file_size, note, uploaded_by_id)
       VALUES (10, 1, 'documents/2025/01/legacy-scan.svg', 'legacy-scan.svg', 85, 'نسخة 1.0.0', 1)`,
    );
  } finally {
    rawClient.close();
  }
}

describe("v1.0.0 -> current version safe migration engine (Zero Data Loss)", () => {
  it("migrates a v1.0.0 database atomically, creates pre-upgrade snapshot, repairs CURRENT_TIMESTAMP, and preserves 100% of records and files", async () => {
    await createV100Database();

    vi.resetModules();
    vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
    vi.stubEnv("EDMS_DATA_DIR", dataDir);
    vi.stubEnv("EDMS_STORAGE_DIR", storageDir);

    const { ensureSeeded } = await import("@/lib/seed");
    await ensureSeeded();

    const { db } = await import("@/db");
    const { users, documents, documentTags, documentVersions } = await import("@/db/schema");
    const {
      TARGET_SCHEMA_VERSION,
      getSchemaUserVersion,
      verifyDatabaseIntegrity,
      listPreUpgradeSnapshots,
      prunePreUpgradeSnapshots,
    } = await import("@/lib/upgrade-engine");

    // 1. Schema version upgraded to TARGET_SCHEMA_VERSION
    const userVer = await getSchemaUserVersion();
    expect(userVer).toBe(TARGET_SCHEMA_VERSION);

    // 2. Integrity and foreign key checks pass
    const integrity = await verifyDatabaseIntegrity({ enforceForeignKeys: true });
    expect(integrity.integrityOk).toBe(true);
    expect(integrity.foreignKeyViolations).toBe(0);

    // 3. Pre-upgrade snapshot was automatically created
    const snapshots = await listPreUpgradeSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots[0].name).toContain("edms-pre-v1.0.0");

    // 4. All users preserved + username & passwordHash backfilled
    const allUsers = await db.select().from(users);
    expect(allUsers).toHaveLength(2);
    const legacyAdmin = allUsers.find((u) => u.email === "admin.legacy@edms.gov")!;
    expect(legacyAdmin.username).toBe("admin.legacy");
    expect(legacyAdmin.passwordHash).toBeTruthy();
    expect(legacyAdmin.mustChangePassword).toBe(1);
    expect(legacyAdmin.createdAt).not.toBe("CURRENT_TIMESTAMP");

    // 5. All documents, content_text descriptions, tags, versions preserved
    const allDocs = await db.select().from(documents);
    expect(allDocs).toHaveLength(2);
    const doc10 = allDocs.find((d) => d.id === 10)!;
    expect(doc10.title).toBe("وثيقة ممسوحة من الإصدار الأول");
    expect(doc10.contentText).toBe("وصف تاريخي هام للمستند مخزن في content_text منذ الإصدار 1.0.0");
    expect(doc10.docTypeId).toBe(1);
    expect(doc10.deletedAt).toBeNull();
    expect(doc10.createdAt).not.toBe("CURRENT_TIMESTAMP");
    expect(doc10.updatedAt).not.toBe("CURRENT_TIMESTAMP");

    const allTags = await db.select().from(documentTags);
    expect(allTags).toHaveLength(3);

    const allVersions = await db.select().from(documentVersions);
    expect(allVersions).toHaveLength(1);
    expect(allVersions[0].createdAt).not.toBe("CURRENT_TIMESTAMP");

    // 6. Files on disk (.svg and uppercase .PDF) remain untouched
    expect(existsSync(path.join(storageDir, "documents", "2025", "01", "legacy-scan.svg"))).toBe(true);
    expect(existsSync(path.join(storageDir, "documents", "2025", "01", "UPPERCASE.PDF"))).toBe(true);

    // 7. Snapshot retention pruning keeps at most 5 snapshots
    const backupsDir = path.join(dataDir, "backups", "pre-upgrade");
    for (let i = 0; i < 7; i++) {
      writeFileSync(path.join(backupsDir, `edms-pre-v1.0.${i}-2026-01-0${i + 1}T00-00-00Z.db`), "dummy");
    }
    await prunePreUpgradeSnapshots(backupsDir, 5);
    const remaining = readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
    expect(remaining.length).toBeLessThanOrEqual(5);
  });
});
