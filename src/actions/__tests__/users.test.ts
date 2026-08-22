import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * Unit tests for the user server actions (createUser / updateUser).
 *
 * The `@/db` and `@/lib/server` modules are mocked with an in-memory store
 * that mirrors the real libsql behaviour for UNIQUE constraints
 * (`UNIQUE constraint failed: users.<column>`), so the actions' Arabic
 * error translation is exercised end-to-end. Password hashing stays real
 * (scrypt via node:crypto) so hash round-trips are actually verified.
 */
const mocks = vi.hoisted(() => {
  type StoredUser = { id: number; username: string; email: string };

  const store: StoredUser[] = [];
  let nextId = 1;
  let lastInsert: Record<string, unknown> | null = null;
  let lastUpdate: Record<string, unknown> | null = null;

  const uniqueError = (column: string) =>
    new Error(`UNIQUE constraint failed: users.${column}`);

  const dbInsert = vi.fn((_table: unknown) => ({
    values: (values: Record<string, unknown>) => ({
      returning: async () => {
        lastInsert = values;
        const username = String(values.username ?? "");
        const email = String(values.email ?? "");
        if (store.some((u) => u.username === username)) throw uniqueError("username");
        if (store.some((u) => u.email === email)) throw uniqueError("email");
        const row = { id: nextId++, ...values };
        store.push(row as unknown as StoredUser);
        return [{ id: row.id }];
      },
    }),
  }));

  const dbUpdate = vi.fn((_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        lastUpdate = values;
        const username = String(values.username ?? "");
        const email = String(values.email ?? "");
        if (username && store.some((u) => u.username === username)) throw uniqueError("username");
        if (email && store.some((u) => u.email === email)) throw uniqueError("email");
      },
    }),
  }));

  return {
    db: { insert: dbInsert, update: dbUpdate },
    dbInsert,
    dbUpdate,
    getCurrentUser: vi.fn(async () => ({
      id: 1,
      name: "مدير النظام",
      role: "admin",
    })),
    logAudit: vi.fn(async () => {}),
    revalidatePath: vi.fn(),
    get lastInsert() {
      return lastInsert;
    },
    get lastUpdate() {
      return lastUpdate;
    },
    seed(u: { username: string; email: string }) {
      store.push({ id: nextId++, ...u });
    },
    reset() {
      store.length = 0;
      nextId = 1;
      lastInsert = null;
      lastUpdate = null;
    },
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
  logAudit: mocks.logAudit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createUser, updateUser } from "@/actions/users";

function baseCreateForm() {
  const fd = new FormData();
  fd.set("name", "أحمد محمد");
  fd.set("email", "ahmed@example.com");
  fd.set("username", "ahmed");
  fd.set("password", "StrongPass123");
  fd.set("role", "staff");
  return fd;
}

function baseUpdateForm() {
  const fd = new FormData();
  fd.set("id", "5");
  fd.set("name", "أحمد محمد");
  fd.set("email", "ahmed@example.com");
  fd.set("username", "ahmed");
  fd.set("role", "staff");
  return fd;
}

describe("createUser", () => {
  beforeEach(() => {
    mocks.reset();
    vi.clearAllMocks();
  });

  it("stores a valid scrypt hash and forces a password change on first login", async () => {
    const fd = baseCreateForm();
    fd.set("username", "Ahmed"); // uppercase input → must be normalized
    await createUser(fd);

    expect(mocks.lastInsert).not.toBeNull();
    // username normalized to lowercase
    expect(mocks.lastInsert!.username).toBe("ahmed");
    // stored hash round-trips with the plaintext password
    expect(mocks.lastInsert!.passwordHash).toBeTruthy();
    expect(verifyPassword("StrongPass123", mocks.lastInsert!.passwordHash as string)).toBe(true);
    expect(mocks.lastInsert!.mustChangePassword).toBe(1);

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.create", entityId: 1 })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("rejects a password shorter than 8 characters with an Arabic message", async () => {
    const fd = baseCreateForm();
    fd.set("password", "1234567"); // 7 chars
    await expect(createUser(fd)).rejects.toThrow("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("rejects a missing username with an Arabic message", async () => {
    const fd = baseCreateForm();
    fd.delete("username");
    await expect(createUser(fd)).rejects.toThrow("اسم الدخول مطلوب");
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username with an Arabic message", async () => {
    mocks.seed({ username: "ahmed", email: "other@example.com" });
    const fd = baseCreateForm();
    await expect(createUser(fd)).rejects.toThrow("اسم الدخول مستخدم مسبقاً");
    // no audit entry is written for a failed insert
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email with an Arabic message", async () => {
    mocks.seed({ username: "someone", email: "ahmed@example.com" });
    const fd = baseCreateForm();
    await expect(createUser(fd)).rejects.toThrow("البريد الإلكتروني مستخدم مسبقاً");
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    mocks.reset();
    vi.clearAllMocks();
  });

  it("replaces the hash and forces a password change when newPassword is provided", async () => {
    const fd = baseUpdateForm();
    fd.set("newPassword", "NewPass123");
    await updateUser(fd);

    expect(mocks.lastUpdate).not.toBeNull();
    expect(mocks.lastUpdate!.username).toBe("ahmed");
    expect(mocks.lastUpdate!.passwordHash).toBeTruthy();
    expect(verifyPassword("NewPass123", mocks.lastUpdate!.passwordHash as string)).toBe(true);
    expect(mocks.lastUpdate!.mustChangePassword).toBe(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/users");
  });

  it("leaves the password untouched when newPassword is empty", async () => {
    const fd = baseUpdateForm();
    fd.set("newPassword", "");
    await updateUser(fd);

    expect(mocks.lastUpdate!.passwordHash).toBeUndefined();
    expect(mocks.lastUpdate!.mustChangePassword).toBeUndefined();
  });

  it("rejects a short newPassword with an Arabic message", async () => {
    const fd = baseUpdateForm();
    fd.set("newPassword", "abc"); // 3 chars
    await expect(updateUser(fd)).rejects.toThrow("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("rejects a username taken by another user with an Arabic message", async () => {
    mocks.seed({ username: "taken", email: "taken@example.com" });
    const fd = baseUpdateForm();
    fd.set("username", "taken");
    await expect(updateUser(fd)).rejects.toThrow("اسم الدخول مستخدم مسبقاً");
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});

// Keep the hashing helpers exercised together with the action contract:
describe("hashPassword round-trip (action contract)", () => {
  it("the helper used by the actions verifies correctly", () => {
    const hash = hashPassword("Contract@123");
    expect(verifyPassword("Contract@123", hash)).toBe(true);
    expect(verifyPassword("Wrong@123", hash)).toBe(false);
  });
});