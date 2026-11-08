const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 5 });

const db = getFirestore();
const auth = getAuth();

function requireTeacher(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const token = request.auth.token;
  if (token.role !== "teacher" || !token.classId) {
    throw new HttpsError("permission-denied", "Teacher access is required.");
  }
  return { uid: request.auth.uid, classId: token.classId };
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

exports.createStudent = onCall(async (request) => {
  const teacher = requireTeacher(request);
  const name = cleanText(request.data?.name, 60);
  const email = cleanText(request.data?.email, 254).toLowerCase();
  const avatar = cleanText(request.data?.avatar, 16) || "🐟";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid student name and email.");
  }

  let userRecord;
  try {
    const temporaryPassword = crypto.randomBytes(24).toString("base64url");
    userRecord = await auth.createUser({
      email,
      password: temporaryPassword,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "student",
      classId: teacher.classId,
    });
    await db.doc(`classes/${teacher.classId}/students/${userRecord.uid}`).set({
      name,
      avatar,
      xp: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { uid: userRecord.uid };
  } catch (error) {
    if (userRecord?.uid) {
      await auth.deleteUser(userRecord.uid).catch(() => {});
    }
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with that email already exists.");
    }
    console.error("createStudent failed", error);
    throw new HttpsError("internal", "Could not create the student account.");
  }
});

exports.awardXP = onCall(async (request) => {
  const teacher = requireTeacher(request);
  const studentId = cleanText(request.data?.studentId, 128);
  const xp = Number(request.data?.xp);
  const reason = cleanText(request.data?.reason, 140) || "Achievement recognized";
  if (!studentId || !Number.isInteger(xp) || xp < 1 || xp > 100) {
    throw new HttpsError("invalid-argument", "Student and XP (1–100) are required.");
  }
  const studentRef = db.doc(`classes/${teacher.classId}/students/${studentId}`);
  const historyRef = db.collection(`classes/${teacher.classId}/activityHistory`).doc();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(studentRef);
    if (!snap.exists) throw new HttpsError("not-found", "Student not found in this class.");
    tx.update(studentRef, { xp: (snap.data().xp || 0) + xp });
    tx.set(historyRef, {
      studentId,
      xp,
      reason,
      teacherId: teacher.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

exports.postAnnouncement = onCall(async (request) => {
  const teacher = requireTeacher(request);
  const title = cleanText(request.data?.title, 90);
  const message = cleanText(request.data?.message, 1000);
  if (!title || !message) throw new HttpsError("invalid-argument", "Title and message are required.");
  const ref = await db.collection(`classes/${teacher.classId}/announcements`).add({
    title,
    message,
    teacherId: teacher.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

exports.removeStudent = onCall(async (request) => {
  const teacher = requireTeacher(request);
  const studentId = cleanText(request.data?.studentId, 128);
  if (!studentId || studentId === teacher.uid) {
    throw new HttpsError("invalid-argument", "Invalid student account.");
  }
  const studentRef = db.doc(`classes/${teacher.classId}/students/${studentId}`);
  const snap = await studentRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Student not found.");
  // Remove the public student document and their history before deleting Auth identity.
  const history = await db.collection(`classes/${teacher.classId}/activityHistory`)
    .where("studentId", "==", studentId).get();
  const batch = db.batch();
  history.docs.forEach(d => batch.delete(d.ref));
  batch.delete(studentRef);
  await batch.commit();
  await auth.deleteUser(studentId).catch((e) => {
    if (e.code !== "auth/user-not-found") throw e;
  });
  return { success: true };
});
