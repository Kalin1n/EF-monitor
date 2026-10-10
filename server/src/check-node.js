// Імпортується першим в index.js: дає зрозуміле повідомлення замість «Unknown builtin module».
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 13);
if (!ok) {
  console.error(
    `Потрібен Node.js 22.13 або новіший (зараз ${process.versions.node}): використовується вбудований node:sqlite.\n` +
      'Завантаж LTS з https://nodejs.org і спробуй ще раз.',
  );
  process.exit(1);
}
