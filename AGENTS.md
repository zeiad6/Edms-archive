<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 🚫 قاعدة الملخصات (NO SUMMARIES RULE) — إلزامية لكل الوكلاء وكل الجلسات وكل المشاريع

1. **ممنوع منعاً باتاً** افتتاح أي رد بصيغة ملخص أو عناوينه — تحديداً: `## Objective`، `## Important Details`، `## Work State`، `## Next Move`، `## Relevant Files`، "سيرة الجلسة"، أو أي تركيب مشابه. أي رسالة تبدأ بهذه العناوين = ملخص مرفوض، يُعاد صياغتها لتبدأ مباشرة بالمطلوب.
2. **الرد يبدأ مباشرة بالمطلوب** — أجب عن سؤال المستخدم أو نفّذ الطلب أول سطر، بدون تمهيد ولا "حالة عمل" ولا "ما تم سابقاً".
3. **الملخص يُكتب فقط** عند طلب صريح حرفي من المستخدم ("لخص"، "سيرة الجلسة"، "ملخص الجلسة") أو عند بدء جلسة جديدة بطلب استرجاع صريح — مرة واحدة وبحد أقصى 5-10 أسطر: ما تم، ما المطلوب، الخطوة التالية.
4. **ممنوع إنشاء ملفات ملخصات تلقائية** — لا `.anchored-summary.md`، لا `session-summary.md`، لا `summary.md`، لا `task_plan.md`، لا `progress.md` — إلا بأمر صريح من المستخدم. الملفات القائمة لا تُحدَّث تلقائياً.
5. **النطاق شامل وإلزامي** — تنطبق على: opencode، Claude Code، Cursor، Codex، وأي وكيل، في أي مجلد عمل، وفي أي جلسة. كل `AGENTS.md` / `CLAUDE.md` في أي مشروع يعتمد هذه القاعدة أو يكررها حرفياً.
6. **عند لصق مستخدم لملخص قديم في رسالته** — لا تعيد إنتاجه ولا تتبنّى صيغته؛ استخرج منه المطلوب فقط وأجب مباشرة.