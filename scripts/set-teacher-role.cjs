// One-time setup: assign the first teacher role and create the class document.
// Run only from a trusted computer with Firebase Admin credentials.
// Usage: node scripts/set-teacher-role.cjs teacher@example.com grade12-section-a "Grade 12 - Section A"
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const [email, classId, className] = process.argv.slice(2);
if (!email || !classId || !className) {
  console.error('Usage: node scripts/set-teacher-role.cjs <teacher-email> <class-id> "<class-name>"');
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
(async () => {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { role: "teacher", classId });
  await getFirestore().doc(`classes/${classId}`).set({
    className,
    teacherId: user.uid,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`Teacher role assigned to ${email} for class ${classId}. Sign out and sign back in to refresh claims.`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
