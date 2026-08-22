import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/**
 * EDMS — نظام الأرشفة الإلكترونية
 * Schema modeled on the Unified Backend architecture:
 *  - Files are stored in object-style storage (filesystem / MinIO), NOT in the DB.
 *  - The DB only stores metadata, references (storage keys) and the OCR-extracted
 *    full text used by the search engine.
 */

/** Organizational departments — each document belongs to exactly one. */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  code: text("code"),
  description: text("description"),
  color: text("color").notNull().default("#4f46e5"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

/**
 * System users with role-based access.
 * Roles: `admin` (full access), `manager` (department-level), `staff` (own docs).
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    // Login identity: the user signs in with username + password. `email`
    // remains for internal/internal contact use only — never for login.
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    // scrypt hash (`scrypt$N$r$p$salt$hash`) — NULL for users that predate
    // password auth; they can still be switched to via the demo picker.
    passwordHash: text("password_hash"),
    // When 1, the user must set a personal password on next login (e.g. after
    // a default-password backfill). Cleared once `changePassword` runs.
    mustChangePassword: integer("must_change_password").notNull().default(0),
    jobTitle: text("job_title"),
    role: text("role", { enum: ["admin", "manager", "staff"] }).notNull().default("staff"),
    departmentId: integer("department_id").references(() => departments.id),
    avatarColor: text("avatar_color").notNull().default("#4f46e5"),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [index("users_dept_idx").on(t.departmentId)]
);

/**
 * Hierarchical folders for organizing documents within departments.
 * `parentId` is null for top-level folders; supports arbitrary nesting.
 */
export const folders = sqliteTable(
  "folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    departmentId: integer("department_id").references(() => departments.id),
    description: text("description"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [
    index("folders_parent_idx").on(t.parentId),
    index("folders_dept_idx").on(t.departmentId),
  ]
);

/** User-defined labels for tagging documents (many-to-many via `document_tags`). */
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#64748b"),
});

/**
 * Document classification types (e.g. "contract", "invoice", "letter").
 * `sortOrder` controls display order in the UI.
 */
export const docTypes = sqliteTable("doc_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  nameEn: text("name_en"),
  color: text("color").notNull().default("#64748b"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
export type DocType = typeof docTypes.$inferSelect;

/**
 * Core document metadata. Binary files live on disk under `storage/`;
 * only the `storageKey` reference is stored here.
 *
 * Supports: soft delete (`deletedAt`), versioning (`version`), OCR
 * full-text (`contentText`), and per-department confidentiality.
 */
export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description"),
    docNumber: text("doc_number"),
    docType: text("doc_type"),
    docTypeId: integer("doc_type_id").references(() => docTypes.id),
    status: text("status", { enum: ["draft", "pending_review", "active", "archived"] })
      .notNull()
      .default("active"),
    confidential: integer("confidential").notNull().default(0),

    // Storage references (object storage keys) — never the binary itself
    storageKey: text("storage_key").notNull(),
    thumbKey: text("thumb_key"),
    originalName: text("original_name").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileExt: text("file_ext"),
    fileSize: integer("file_size").notNull(),
    pageCount: integer("page_count").default(1),

    // OCR-extracted full text, indexed by the search engine
    contentText: text("content_text"),
    ocrProcessed: integer("ocr_processed").notNull().default(0),

    departmentId: integer("department_id").references(() => departments.id),
    folderId: integer("folder_id").references(() => folders.id),
    version: integer("version").notNull().default(1),

    docDate: text("doc_date"),
    // كلمات مفتاحية مفصولة بفواصل لتحسين البحث والتصنيف (مثال: عقد، توريد، 2024)
    keywords: text("keywords"),
    // مصدر المستند: بريد وارد / بريد صادر / فاكس / يدوي / داخلي / أخرى
    source: text("source"),
    // ملاحظات داخلية (اختيارية، غير ظاهرة للجمهور)
    notes: text("notes"),
    uploadedById: integer("uploaded_by_id")
      .notNull()
      .references(() => users.id),

    // Soft delete
    deletedAt: text("deleted_at"),
    deletedById: integer("deleted_by_id").references(() => users.id),

    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [
    index("documents_dept_idx").on(t.departmentId),
    index("documents_folder_idx").on(t.folderId),
    index("documents_status_idx").on(t.status),
    index("documents_uploader_idx").on(t.uploadedById),
    index("documents_type_idx").on(t.docType),
    index("documents_created_at_idx").on(t.createdAt),
    index("documents_updated_at_idx").on(t.updatedAt),
    index("documents_deleted_at_idx").on(t.deletedAt),
    index("documents_doc_date_idx").on(t.docDate),
    index("documents_doc_type_id_idx").on(t.docTypeId),
  ]
);

/** Junction table: many-to-many relationship between documents and tags. */
export const documentTags = sqliteTable(
  "document_tags",
  {
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.tagId] }),
    index("doctags_tag_idx").on(t.tagId),
  ]);

/**
 * Immutable version history for documents. Each upload creates a new row;
 * the current version is determined by `documents.version`.
 */
export const documentVersions = sqliteTable(
  "document_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    fileSize: integer("file_size").notNull(),
    note: text("note"),
    uploadedById: integer("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [index("versions_doc_idx").on(t.documentId)]
);

/**
 * Append-only audit trail. Every significant action (create, update,
 * delete, approve, etc.) is recorded here. Never updated or deleted.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    userName: text("user_name"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    details: text("details"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_user_idx").on(t.userId),
    index("audit_created_at_idx").on(t.createdAt),
  ]);

export type Department = typeof departments.$inferSelect;
export type User = typeof users.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
/**
 * Document approval workflow requests. A requester assigns an approver;
 * the approver can approve, reject, or leave a comment.
 */
export const approvalRequests = sqliteTable(
  "approval_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    requestedById: integer("requested_by_id")
      .notNull()
      .references(() => users.id),
    assignedToId: integer("assigned_to_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    comment: text("comment"),
    responseNote: text("response_note"),
    respondedAt: text("responded_at"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (t) => [
    index("approval_doc_idx").on(t.documentId),
    index("approval_assigned_idx").on(t.assignedToId),
    index("approval_status_idx").on(t.status),
    index("approval_created_at_idx").on(t.createdAt),
  ]
);

/**
 * In-app notifications for approval events. Each row is scoped to a
 * single user and marked read via `readAt` timestamp.
 */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["approval_requested", "approval_approved", "approval_rejected"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "set null" }),
  referenceId: integer("reference_id"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (t) => [
  index("notif_user_idx").on(t.userId),
  index("notif_read_idx").on(t.userId, t.readAt),
  index("notif_created_at_idx").on(t.createdAt),
]);

/**
 * Digital signatures attached to documents. `dataUrl` stores the
 * base64-encoded signature image drawn by the user.
 */
export const signatures = sqliteTable("signatures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").default("توقيع"),
  dataUrl: text("data_url").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (t) => [
  index("sig_doc_idx").on(t.documentId),
  index("sig_user_idx").on(t.userId),
]);

/**
 * Reusable document templates with pre-configured department, folder,
 * type, and tags. Used to speed up common document creation flows.
 */
export const documentTemplates = sqliteTable("document_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  titlePattern: text("title_pattern").notNull().default("{{title}}"),
  departmentId: integer("department_id").references(() => departments.id),
  folderId: integer("folder_id").references(() => folders.id),
  docType: text("doc_type"),
  defaultTags: text("default_tags"), // comma-separated
  status: text("status", { enum: ["draft", "active", "archived"] }).default("active"),
  sortOrder: integer("sort_order").default(0),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Signature = typeof signatures.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;