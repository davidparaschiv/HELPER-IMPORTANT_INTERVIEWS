import "./style.css";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase.js";

const COLLECTION = "questions";
const questionsRef = collection(db, COLLECTION);

let items = [];
let currentSubject = "";
let currentPosition = 0;
let editingId = null;
let unsubscribe = null;
let seeding = false;

const $ = id => document.getElementById(id);
const homeView = $("homeView");
const viewerView = $("viewerView");
const statusBar = $("statusBar");
const subjectBadge = $("subjectBadge");
const counter = $("counter");
const progressBar = $("progressBar");
const questionText = $("questionText");
const questionEditBtn = $("questionEditBtn");
const answerText = $("answerText");
const previousBtn = $("previousBtn");
const nextBtn = $("nextBtn");
const homeBtn = $("homeBtn");
const homeTopBtn = $("homeTopBtn");
const addBtn = $("addBtn");
const editBtn = $("editBtn");
const deleteBtn = $("deleteBtn");
const refreshBtn = $("refreshBtn");
const itemDialog = $("itemDialog");
const itemForm = $("itemForm");
const dialogTitle = $("dialogTitle");
const subjectSelect = $("subjectSelect");
const newSubjectField = $("newSubjectField");
const newSubjectInput = $("newSubjectInput");
const questionInput = $("questionInput");
const answerInput = $("answerInput");
const closeDialogBtn = $("closeDialogBtn");
const cancelBtn = $("cancelBtn");
const saveBtn = $("saveBtn");

function setStatus(message, type = "") {
  statusBar.textContent = message;
  statusBar.className = `status ${type}`.trim();
}

function normalizeItem(id, data) {
  return {
    id,
    subject: String(data.subject || "General").trim() || "General",
    question: String(data.question || "Untitled topic").trim() || "Untitled topic",
    answer: String(data.answer || "").trim(),
    order: Number.isFinite(data.order) ? data.order : Number.MAX_SAFE_INTEGER
  };
}

async function seedIfEmpty() {
  if (seeding) return;
  seeding = true;
  try {
    const existing = await getDocs(questionsRef);
    if (!existing.empty) return;

    setStatus("Importing the starter interview cards…");
    const response = await fetch(`${import.meta.env.BASE_URL}questions.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Starter JSON returned HTTP ${response.status}.`);
    const starter = await response.json();
    if (!Array.isArray(starter)) throw new Error("Starter questions.json must contain an array.");

    for (let start = 0; start < starter.length; start += 450) {
      const batch = writeBatch(db);
      starter.slice(start, start + 450).forEach((entry, offset) => {
        const ref = doc(questionsRef);
        batch.set(ref, {
          subject: String(entry.subject || "General").trim(),
          question: String(entry.question || "Untitled topic").trim(),
          answer: String(entry.answer || "").trim(),
          order: start + offset,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
    setStatus("Starter cards imported successfully.", "success");
  } finally {
    seeding = false;
  }
}

function subscribeToQuestions() {
  if (unsubscribe) unsubscribe();
  setStatus("Connecting to Firebase…");

  const ordered = query(questionsRef, orderBy("order", "asc"));
  unsubscribe = onSnapshot(ordered, async snapshot => {
    if (snapshot.empty) {
      try {
        await seedIfEmpty();
      } catch (error) {
        console.error(error);
        setStatus(`Could not import starter cards: ${error.message}`, "error");
      }
      return;
    }

    items = snapshot.docs.map(document => normalizeItem(document.id, document.data()));
    setStatus(`${items.length} cards loaded from Firebase.`, "success");

    if (currentSubject && getSubjectItems(currentSubject).length) {
      renderViewer();
    } else {
      currentSubject = "";
      currentPosition = 0;
      renderHome();
    }
  }, error => {
    console.error(error);
    setStatus(`Firebase error: ${error.message}`, "error");
    homeView.hidden = false;
    viewerView.hidden = true;
    homeView.innerHTML = `<div class="empty"><h2>Could not load Firestore</h2><p>${escapeHtml(error.message)}</p><p>Create the Firestore database and publish rules that allow this app to read and write the questions collection.</p></div>`;
  });
}

function getSubjects() {
  return [...new Set(items.map(item => item.subject))].sort((a, b) => a.localeCompare(b));
}

function getSubjectItems(subject) {
  return items.filter(item => item.subject === subject);
}

function renderHome() {
  viewerView.hidden = true;
  homeView.hidden = false;
  const subjects = getSubjects();

  if (!subjects.length) {
    homeView.innerHTML = '<div class="empty"><h2>No cards yet</h2><p>Use Add to create the first card.</p></div>';
    return;
  }

  homeView.innerHTML = `
    <div class="home-heading">
      <div>
        <h2>Choose a subject</h2>
        <p>Cards stay synchronized through Firebase.</p>
      </div>
    </div>
    <div class="subject-grid">
      ${subjects.map(subject => {
        const count = getSubjectItems(subject).length;
        return `<button class="subject-card" type="button" data-subject="${escapeHtml(subject)}"><h3>${escapeHtml(subject)}</h3><p><span class="subject-count">${count}</span> ${count === 1 ? "card" : "cards"}</p></button>`;
      }).join("")}
    </div>`;

  homeView.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => openSubject(button.dataset.subject));
  });
}

function openSubject(subject, position = 0) {
  const subjectItems = getSubjectItems(subject);
  if (!subjectItems.length) return renderHome();
  currentSubject = subject;
  currentPosition = Math.max(0, Math.min(position, subjectItems.length - 1));
  renderViewer();
}

function renderViewer() {
  const subjectItems = getSubjectItems(currentSubject);
  if (!subjectItems.length) return renderHome();
  currentPosition = Math.max(0, Math.min(currentPosition, subjectItems.length - 1));
  const current = subjectItems[currentPosition];

  homeView.hidden = true;
  viewerView.hidden = false;
  subjectBadge.textContent = current.subject;
  counter.textContent = `${currentPosition + 1} / ${subjectItems.length}`;
  progressBar.style.width = `${((currentPosition + 1) / subjectItems.length) * 100}%`;
  questionText.textContent = current.question;
  renderAnswer(current.answer);
  previousBtn.disabled = currentPosition === 0;
  nextBtn.disabled = currentPosition === subjectItems.length - 1;
}

function renderAnswer(answer) {
  answerText.replaceChildren();
  const commandPattern = /(?:'([^'\n]+)'|`([^`\n]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = commandPattern.exec(answer)) !== null) {
    appendTextParagraphs(answer.slice(lastIndex, match.index));
    const pre = document.createElement("pre");
    pre.className = "command-block";
    const code = document.createElement("code");
    code.textContent = match[1] || match[2];
    pre.appendChild(code);
    answerText.appendChild(pre);
    lastIndex = commandPattern.lastIndex;
  }
  appendTextParagraphs(answer.slice(lastIndex));
}

function appendTextParagraphs(text) {
  const clean = text.trim();
  if (!clean) return;
  const paragraphs = clean
    .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(part => part.trim())
    .filter(Boolean);

  paragraphs.forEach(content => {
    const p = document.createElement("p");
    p.textContent = content;
    answerText.appendChild(p);
  });
}

function currentItem() {
  return getSubjectItems(currentSubject)[currentPosition] || null;
}

function fillSubjectOptions(selected = "") {
  const subjects = getSubjects();
  subjectSelect.innerHTML = [
    ...subjects.map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`),
    '<option value="__new__">Create new subject…</option>'
  ].join("");
  subjectSelect.value = selected && subjects.includes(selected) ? selected : (subjects[0] || "__new__");
  toggleNewSubjectField();
}

function toggleNewSubjectField() {
  const isNew = subjectSelect.value === "__new__";
  newSubjectField.hidden = !isNew;
  newSubjectInput.required = isNew;
  if (!isNew) newSubjectInput.value = "";
}

function openAddDialog() {
  editingId = null;
  dialogTitle.textContent = "Add card";
  fillSubjectOptions(currentSubject);
  questionInput.value = "";
  answerInput.value = "";
  newSubjectInput.value = "";
  itemDialog.showModal();
}

function openEditDialog() {
  const item = currentItem();
  if (!item) return;
  editingId = item.id;
  dialogTitle.textContent = "Edit card";
  fillSubjectOptions(item.subject);
  questionInput.value = item.question;
  answerInput.value = item.answer;
  itemDialog.showModal();
}

function closeDialog() {
  itemDialog.close();
  itemForm.reset();
  editingId = null;
  saveBtn.disabled = false;
  saveBtn.textContent = "Save";
}

async function removeCurrent() {
  const item = currentItem();
  if (!item || !confirm(`Remove this card from ${item.subject}?`)) return;
  try {
    deleteBtn.disabled = true;
    setStatus("Removing card…");
    await deleteDoc(doc(db, COLLECTION, item.id));
    currentPosition = Math.max(0, currentPosition - 1);
    setStatus("Card removed.", "success");
  } catch (error) {
    console.error(error);
    setStatus(`Could not remove card: ${error.message}`, "error");
  } finally {
    deleteBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

previousBtn.addEventListener("click", () => { if (currentPosition > 0) { currentPosition--; renderViewer(); } });
nextBtn.addEventListener("click", () => { const length = getSubjectItems(currentSubject).length; if (currentPosition < length - 1) { currentPosition++; renderViewer(); } });
homeBtn.addEventListener("click", renderHome);
homeTopBtn.addEventListener("click", renderHome);
addBtn.addEventListener("click", openAddDialog);
editBtn.addEventListener("click", openEditDialog);
questionEditBtn.addEventListener("click", openEditDialog);
deleteBtn.addEventListener("click", removeCurrent);
refreshBtn.addEventListener("click", subscribeToQuestions);
closeDialogBtn.addEventListener("click", closeDialog);
cancelBtn.addEventListener("click", closeDialog);
subjectSelect.addEventListener("change", toggleNewSubjectField);

itemForm.addEventListener("submit", async event => {
  event.preventDefault();
  const subject = subjectSelect.value === "__new__" ? newSubjectInput.value.trim() : subjectSelect.value.trim();
  const question = questionInput.value.trim();
  const answer = answerInput.value.trim();
  if (!subject || !question || !answer) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    let savedId = editingId;
    if (editingId) {
      await updateDoc(doc(db, COLLECTION, editingId), {
        subject,
        question,
        answer,
        updatedAt: serverTimestamp()
      });
      currentSubject = subject;
      setStatus("Card updated.", "success");
    } else {
      const nextOrder = items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
      const created = await addDoc(questionsRef, {
        subject,
        question,
        answer,
        order: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      savedId = created.id;
      currentSubject = subject;
      setStatus("Card added.", "success");
    }
    closeDialog();
    const newPosition = getSubjectItems(subject).findIndex(item => item.id === savedId);
    currentPosition = Math.max(0, newPosition);
  } catch (error) {
    console.error(error);
    setStatus(`Could not save card: ${error.message}`, "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
});

itemDialog.addEventListener("click", event => {
  const rect = itemDialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) closeDialog();
});

window.addEventListener("beforeunload", () => unsubscribe?.());
subscribeToQuestions();
