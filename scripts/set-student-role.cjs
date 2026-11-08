// Run only on a trusted computer. Never expose service-account credentials to the website.
// Usage: node scripts/set-student-role.cjs student@example.com grade12-section-a
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const [email, classId] = process.argv.slice(2);
if (!email || !classId) {
  console.error("Usage: node scripts/set-student-role.cjs <student-email> <class-id>");
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
(async () => {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { role: "student", classId });
  console.log(`Student role assigned to ${email}. Ask the student to sign out and sign in again.`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
